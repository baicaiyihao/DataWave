// Copyright (c), DataWave Survey System
// SPDX-License-Identifier: Apache-2.0

module datawave::survey_system;

use std::string::String;
use sui::{
    table::{Self, Table},
    balance::{Self, Balance},
    clock::Clock,
    coin::{Self, Coin},
    sui::SUI,
    vec_set::{Self, VecSet},
    event
};

// =================== 错误码 ===================
const EInvalidCap: u64 = 0;
const ENoAccess: u64 = 1;
const EInvalidFee: u64 = 3;
const ESurveyCompleted: u64 = 4;
const EAlreadyAnswered: u64 = 5;
const ENoDividend: u64 = 8;
const EInvalidRatio: u64 = 9;
const EInsufficientInitialPool: u64 = 10;
const ENotAdmin: u64 = 11;
const ENotAuthorized: u64 = 12;

// =================== 常量 ===================
const HUNDRED_PERCENT: u64 = 10000; // 100.00% 用基点表示
const MAX_CREATOR_SHARE: u64 = 4000; // 创建者最多40%
const MIN_RESPONDENT_SHARE: u64 = 5000; // 答题者至少50%
const MIN_PLATFORM_SHARE: u64 = 500; // 平台至少5%

// =================== 平台管理 ===================

/// 平台配置（one-time witness pattern）
public struct SURVEY_SYSTEM has drop {}

/// 平台管理权限（创建时生成，只有一个）
public struct PlatformAdminCap has key {
    id: UID,
}

/// 平台金库（共享对象，收集平台费用）
public struct PlatformTreasury has key {
    id: UID,
    total_fees_collected: u64,
    balance: Balance<SUI>,
    admin: address,  // 平台管理员地址
}

/// 问卷注册表（全局共享对象）
public struct SurveyRegistry has key {
    id: UID,
    
    // 所有问卷索引
    all_surveys: Table<ID, SurveyMeta>,
    
    // 创建者的问卷映射  
    creator_surveys: Table<address, vector<ID>>,
    
    // 分类
    surveys_by_category: Table<String, vector<ID>>,
    
    // 统计
    total_surveys: u64,
    active_surveys: u64,
    
    // 黑名单
    banned_surveys: VecSet<ID>,
    banned_creators: VecSet<address>,
}

/// 问卷元数据（轻量级索引）
public struct SurveyMeta has store, drop, copy {
    survey_id: ID,
    creator: address,
    title: String,
    category: String,
    created_at: u64,
    is_active: bool,
    is_banned: bool,
}

// =================== 核心结构定义 ===================

/// 单个用户的答案集合
public struct AnswerSet has store, drop, copy {
    respondent: address,           // 答题者地址
    submitted_at: u64,             // 提交时间
    encrypted_blob_id: String,     // Walrus上加密答案的Blob ID
    answer_count: u64,             // 答案数量
    authorized_sharing: bool,      // 是否授权分享（可获得分红）
    reward_amount: u64,            // 获得的填写奖励
    total_earnings: u64,           // 累计总收益（奖励+分红）
}

/// 问卷对象（共享对象）
public struct Survey has key {
    id: UID,
    
    // 基本信息
    title: String,
    description: String,
    questions: vector<String>,      // 问题列表（明文）
    creator: address,
    
    // 状态管理
    is_active: bool,                // 是否接受新答案
    created_at: u64,
    closed_at: Option<u64>,
    auto_close_on_empty_rewards: bool, // 奖励用完时自动关闭
    
    // 答案存储
    answers: Table<address, AnswerSet>,  // key是respondent地址，value是答案集
    answer_count: u64,                   // 总答案数量
    authorized_users: vector<address>,   // 授权分享的用户列表（用于分红）
    authorized_count: u64,                // 授权分享的答案数量
    
    // 访问控制 - Allowlist模式
    allowlist: vector<address>,          // 可以查看答案的地址列表
    
    // 订阅功能
    subscription_enabled: bool,
    subscription_fee: u64,
    subscription_ttl: u64,                // 订阅有效期（毫秒）
    subscribers: Table<address, u64>,     // 订阅者地址 -> 订阅时间
    
    // 填写奖励池
    reward_pool: Balance<SUI>,           // 奖励池余额
    reward_per_response: u64,            // 每份答案的奖励金额
    total_reward_distributed: u64,       // 已分发的奖励总额
    
    // 收益分享设置（创建时确定，不可更改）
    revenue_sharing_enabled: bool,       // 是否启用收益分享
    creator_share_ratio: u64,           // 创建者分成比例
    respondent_share_ratio: u64,        // 答题者分成比例
    platform_share_ratio: u64,          // 平台分成比例
    
    // 收益管理
    revenue_pool: Balance<SUI>,          // 订阅收入池
    dividend_reserve: Balance<SUI>,      // 分红储备池
    total_revenue: u64,                  // 总收入
    distributed_revenue: u64,            // 已分配收入
    
    // 分红设置
    dividend_threshold: u64,             // 触发分红的最小金额
    last_dividend_time: u64,            // 上次分红时间
    min_dividend_interval: u64,          // 最小分红间隔
    
    // 待领取分红
    pending_dividends: Table<address, u64>, // 用户地址 -> 可领取分红金额
}

/// 问卷管理权限
public struct SurveyCap has key {
    id: UID,
    survey_id: ID,
}

/// 订阅凭证
public struct SurveySubscription has key {
    id: UID,
    survey_id: ID,
    subscriber: address,
    subscribed_at: u64,
    expires_at: u64,
}

// =================== 事件定义 ===================

/// 答案提交事件
public struct AnswerSubmittedEvent has copy, drop {
    survey_id: ID,
    respondent: address,
    blob_id: String,
    authorized_sharing: bool,
    reward_amount: u64,
    timestamp: u64,
}

/// 订阅购买事件
public struct SubscriptionPurchasedEvent has copy, drop {
    survey_id: ID,
    subscriber: address,
    fee: u64,
    expires_at: u64,
}

/// 分红分配事件
public struct DividendDistributedEvent has copy, drop {
    survey_id: ID,
    total_amount: u64,
    creator_share: u64,
    respondent_share: u64,
    platform_share: u64,
    authorized_count: u64,
    timestamp: u64,
}

/// 分红领取事件
public struct DividendClaimedEvent has copy, drop {
    survey_id: ID,
    user: address,
    amount: u64,
    timestamp: u64,
}

/// 问卷关闭事件
public struct SurveyClosedEvent has copy, drop {
    survey_id: ID,
    reason: String,
    remaining_pool: u64,
    total_responses: u64,
    timestamp: u64,
}

/// 平台费用提取事件
public struct PlatformFeeWithdrawnEvent has copy, drop {
    amount: u64,
    admin: address,
    timestamp: u64,
}

/// 问卷更新事件
public struct SurveyUpdatedEvent has copy, drop {
    survey_id: ID,
    update_type: String,
    timestamp: u64,
}

// =================== 初始化 ===================

/// 模块初始化函数，部署时自动执行
fun init(_witness: SURVEY_SYSTEM, ctx: &mut TxContext) {
    // 创建平台管理权限，发送给部署者
    let admin_cap = PlatformAdminCap {
        id: object::new(ctx)
    };
    
    // 创建平台金库
    let treasury = PlatformTreasury {
        id: object::new(ctx),
        total_fees_collected: 0,
        balance: balance::zero(),
        admin: ctx.sender(),  // 部署者是管理员
    };
    
    // 创建问卷注册表
    let mut registry = SurveyRegistry {
        id: object::new(ctx),
        all_surveys: table::new(ctx),
        creator_surveys: table::new(ctx),
        surveys_by_category: table::new(ctx),
        total_surveys: 0,
        active_surveys: 0,
        banned_surveys: vec_set::empty(),
        banned_creators: vec_set::empty(),
    };
    
    // 初始化默认分类
    table::add(&mut registry.surveys_by_category, b"market_research".to_string(), vector::empty());
    table::add(&mut registry.surveys_by_category, b"user_feedback".to_string(), vector::empty());
    table::add(&mut registry.surveys_by_category, b"academic_research".to_string(), vector::empty());
    table::add(&mut registry.surveys_by_category, b"product_testing".to_string(), vector::empty());
    table::add(&mut registry.surveys_by_category, b"other".to_string(), vector::empty());
    
    // 共享对象
    transfer::share_object(treasury);
    transfer::share_object(registry);
    
    // 管理权限发送给部署者
    transfer::transfer(admin_cap, ctx.sender());
}

// =================== 平台管理函数 ===================

/// 提取平台费用（内部函数）
public fun withdraw_platform_fees_internal(
    _admin_cap: &PlatformAdminCap,
    treasury: &mut PlatformTreasury,
    amount: u64,
    ctx: &mut TxContext
): Coin<SUI> {
    assert!(balance::value(&treasury.balance) >= amount, EInvalidFee);
    // 额外验证：确保调用者是管理员
    assert!(treasury.admin == ctx.sender(), ENotAdmin);
    
    let payment = coin::take(&mut treasury.balance, amount, ctx);
    
    event::emit(PlatformFeeWithdrawnEvent {
        amount,
        admin: ctx.sender(),
        timestamp: ctx.epoch_timestamp_ms(),
    });
    
    payment
}

/// Entry函数：提取指定金额的平台费用
entry fun withdraw_platform_fees(
    admin_cap: &PlatformAdminCap,
    treasury: &mut PlatformTreasury,
    amount: u64,
    ctx: &mut TxContext
) {
    let payment = withdraw_platform_fees_internal(admin_cap, treasury, amount, ctx);
    transfer::public_transfer(payment, ctx.sender());
}

/// Entry函数：提取全部平台费用
entry fun withdraw_all_platform_fees(
    admin_cap: &PlatformAdminCap,
    treasury: &mut PlatformTreasury,
    ctx: &mut TxContext
) {
    let amount = balance::value(&treasury.balance);
    if (amount > 0) {
        let payment = withdraw_platform_fees_internal(admin_cap, treasury, amount, ctx);
        transfer::public_transfer(payment, ctx.sender());
    }
}

/// Entry函数：提取费用并发送给指定地址
entry fun withdraw_and_transfer_fees(
    admin_cap: &PlatformAdminCap,
    treasury: &mut PlatformTreasury,
    amount: u64,
    recipient: address,
    ctx: &mut TxContext
) {
    let payment = withdraw_platform_fees_internal(admin_cap, treasury, amount, ctx);
    transfer::public_transfer(payment, recipient);
}

/// 更改平台管理员
entry fun change_platform_admin(
    admin_cap: PlatformAdminCap,
    treasury: &mut PlatformTreasury,
    new_admin: address,
) {
    treasury.admin = new_admin;
    transfer::transfer(admin_cap, new_admin);
}

// =================== 问卷创建 ===================

/// 创建带激励和收益分享的问卷
public fun create_survey_with_incentive(
    title: String,
    description: String,
    questions: vector<String>,
    category: String,  // 新增分类参数
    reward_per_response: u64,
    initial_reward_pool: Coin<SUI>,
    dividend_threshold: u64,
    min_interval_hours: u64,
    creator_ratio: u64,
    respondent_ratio: u64,
    auto_close_on_empty: bool,
    registry: &mut SurveyRegistry,  // 传入注册表
    c: &Clock,
    ctx: &mut TxContext,
): SurveyCap {
    let creator = ctx.sender();
    let pool_value = coin::value(&initial_reward_pool);
    
    // 检查创建者是否被封禁
    assert!(!vec_set::contains(&registry.banned_creators, &creator), ENotAuthorized);
    
    // 验证初始奖励池
    assert!(pool_value >= reward_per_response * 10, EInsufficientInitialPool);
    
    // 计算平台分成
    let platform_ratio = HUNDRED_PERCENT - creator_ratio - respondent_ratio;
    
    // 验证比例
    assert!(creator_ratio <= MAX_CREATOR_SHARE, EInvalidRatio);
    assert!(respondent_ratio >= MIN_RESPONDENT_SHARE, EInvalidRatio);
    assert!(platform_ratio >= MIN_PLATFORM_SHARE, EInvalidRatio);
    
    let survey = Survey {
        id: object::new(ctx),
        title: title,
        description: description,
        questions,
        creator,
        is_active: true,
        created_at: c.timestamp_ms(),
        closed_at: option::none(),
        auto_close_on_empty_rewards: auto_close_on_empty,
        
        answers: table::new(ctx),
        answer_count: 0,
        authorized_users: vector::empty(),
        authorized_count: 0,
        
        allowlist: vector::singleton(creator),
        
        subscription_enabled: false,
        subscription_fee: 0,
        subscription_ttl: 0,
        subscribers: table::new(ctx),
        
        reward_pool: coin::into_balance(initial_reward_pool),
        reward_per_response,
        total_reward_distributed: 0,
        
        revenue_sharing_enabled: true,
        creator_share_ratio: creator_ratio,
        respondent_share_ratio: respondent_ratio,
        platform_share_ratio: platform_ratio,
        
        revenue_pool: balance::zero(),
        dividend_reserve: balance::zero(),
        total_revenue: 0,
        distributed_revenue: 0,
        
        dividend_threshold,
        last_dividend_time: c.timestamp_ms(),
        min_dividend_interval: min_interval_hours * 3600 * 1000,
        
        pending_dividends: table::new(ctx),
    };
    
    let survey_id = object::id(&survey);
    
    // 注册到注册表
    let meta = SurveyMeta {
        survey_id,
        creator,
        title: title,
        category: category,
        created_at: c.timestamp_ms(),
        is_active: true,
        is_banned: false,
    };
    
    table::add(&mut registry.all_surveys, survey_id, meta);
    
    // 添加到创建者列表
    if (table::contains(&registry.creator_surveys, creator)) {
        let surveys = table::borrow_mut(&mut registry.creator_surveys, creator);
        vector::push_back(surveys, survey_id);
    } else {
        let mut surveys = vector::empty();
        vector::push_back(&mut surveys, survey_id);
        table::add(&mut registry.creator_surveys, creator, surveys);
    };
    
    // 添加到分类
    if (table::contains(&registry.surveys_by_category, category)) {
        let category_surveys = table::borrow_mut(&mut registry.surveys_by_category, category);
        vector::push_back(category_surveys, survey_id);
    };
    
    // 更新统计
    registry.total_surveys = registry.total_surveys + 1;
    registry.active_surveys = registry.active_surveys + 1;
    
    transfer::share_object(survey);
    
    SurveyCap {
        id: object::new(ctx),
        survey_id,
    }
}

/// Entry函数：创建问卷
entry fun create_survey_entry(
    title: String,
    description: String,
    questions: vector<String>,
    category: String,  // 新增分类
    reward_per_response: u64,
    initial_reward_pool: Coin<SUI>,
    dividend_threshold: u64,
    min_interval_hours: u64,
    creator_ratio: u64,
    respondent_ratio: u64,
    auto_close: bool,
    registry: &mut SurveyRegistry,  // 传入注册表
    c: &Clock,
    ctx: &mut TxContext,
) {
    let cap = create_survey_with_incentive(
        title, description, questions, category,
        reward_per_response, initial_reward_pool,
        dividend_threshold, min_interval_hours,
        creator_ratio, respondent_ratio,
        auto_close, registry, c, ctx
    );
    transfer::transfer(cap, ctx.sender());
}

// =================== 管理员强制操作 ===================

/// 管理员强制关闭问卷
entry fun admin_force_close_survey(
    _admin_cap: &PlatformAdminCap,
    survey: &mut Survey,
    treasury: &mut PlatformTreasury,
    c: &Clock,
    ctx: &mut TxContext,
) {
    survey.is_active = false;
    survey.closed_at = option::some(c.timestamp_ms());
    
    // 强制触发分红（如果有收益）
    try_distribute_dividends(survey, treasury, c.timestamp_ms(), ctx);
    
    event::emit(SurveyClosedEvent {
        survey_id: object::id(survey),
        reason: b"Admin force closed".to_string(),
        remaining_pool: balance::value(&survey.reward_pool),
        total_responses: survey.answer_count,
        timestamp: c.timestamp_ms(),
    });
}

/// 管理员修改问卷状态
entry fun admin_update_survey_status(
    _admin_cap: &PlatformAdminCap,
    survey: &mut Survey,
    is_active: bool,
    c: &Clock,
) {
    survey.is_active = is_active;
    
    if (!is_active && option::is_none(&survey.closed_at)) {
        survey.closed_at = option::some(c.timestamp_ms());
    } else if (is_active) {
        survey.closed_at = option::none();
    };
    
    event::emit(SurveyUpdatedEvent {
        survey_id: object::id(survey),
        update_type: b"admin_status_update".to_string(),
        timestamp: c.timestamp_ms(),
    });
}

// =================== 答案提交（自动发放奖励）===================

/// 提交答案并自动发放奖励
#[allow(lint(self_transfer))]
public fun submit_answer_with_auto_reward(
    survey: &mut Survey,
    encrypted_blob_id: String,
    authorize_sharing: bool,
    c: &Clock,
    ctx: &mut TxContext,
) {
    let respondent = ctx.sender();
    
    // 检查问卷状态
    assert!(survey.is_active, ESurveyCompleted);
    assert!(!table::contains(&survey.answers, respondent), EAlreadyAnswered);
    
    // 检查并发放奖励
    let actual_reward = if (balance::value(&survey.reward_pool) >= survey.reward_per_response) {
        let reward = coin::take(&mut survey.reward_pool, survey.reward_per_response, ctx);
        survey.total_reward_distributed = survey.total_reward_distributed + survey.reward_per_response;
        // 直接转给用户
        transfer::public_transfer(reward, respondent);
        survey.reward_per_response
    } else {
        // 奖励池不足，检查是否自动关闭
        if (survey.auto_close_on_empty_rewards) {
            survey.is_active = false;
            survey.closed_at = option::some(c.timestamp_ms());
            
            event::emit(SurveyClosedEvent {
                survey_id: object::id(survey),
                reason: b"Reward pool exhausted".to_string(),
                remaining_pool: balance::value(&survey.reward_pool),
                total_responses: survey.answer_count,
                timestamp: c.timestamp_ms(),
            });
        };
        0
    };
    
    // 创建答案集
    let answer_set = AnswerSet {
        respondent,
        submitted_at: c.timestamp_ms(),
        encrypted_blob_id,
        answer_count: vector::length(&survey.questions),
        authorized_sharing: authorize_sharing,
        reward_amount: actual_reward,
        total_earnings: actual_reward,
    };
    
    // 存储答案
    table::add(&mut survey.answers, respondent, answer_set);
    survey.answer_count = survey.answer_count + 1;
    
    // 如果授权分享，添加到授权用户列表
    if (authorize_sharing) {
        vector::push_back(&mut survey.authorized_users, respondent);
        survey.authorized_count = survey.authorized_count + 1;
    };
    
    // 发出事件
    event::emit(AnswerSubmittedEvent {
        survey_id: object::id(survey),
        respondent,
        blob_id: encrypted_blob_id,
        authorized_sharing: authorize_sharing,
        reward_amount: actual_reward,
        timestamp: c.timestamp_ms(),
    });
}

/// Entry函数：提交答案（奖励自动转给用户）
entry fun submit_answer_entry(
    survey: &mut Survey,
    encrypted_blob_id: String,
    authorize_sharing: bool,
    c: &Clock,
    ctx: &mut TxContext,
) {
    submit_answer_with_auto_reward(
        survey,
        encrypted_blob_id,
        authorize_sharing,
        c,
        ctx
    );
}

/// 更新已提交的答案
entry fun update_answer_set(
    survey: &mut Survey,
    new_encrypted_blob_id: String,
    c: &Clock,
    ctx: &TxContext,
) {
    let respondent = ctx.sender();
    
    assert!(survey.is_active, ESurveyCompleted);
    assert!(table::contains(&survey.answers, respondent), ENoAccess);
    
    let answer_set = table::borrow_mut(&mut survey.answers, respondent);
    answer_set.encrypted_blob_id = new_encrypted_blob_id;
    answer_set.submitted_at = c.timestamp_ms();
}

// =================== Allowlist 管理 ===================

/// 添加地址到allowlist
entry fun add_to_allowlist(
    survey: &mut Survey,
    cap: &SurveyCap,
    account: address,
) {
    assert!(cap.survey_id == object::id(survey), EInvalidCap);
    
    if (!vector::contains(&survey.allowlist, &account)) {
        vector::push_back(&mut survey.allowlist, account);
    };
}

/// 批量添加到allowlist
entry fun batch_add_to_allowlist(
    survey: &mut Survey,
    cap: &SurveyCap,
    accounts: vector<address>,
) {
    assert!(cap.survey_id == object::id(survey), EInvalidCap);
    
    let mut i = 0;
    while (i < vector::length(&accounts)) {
        let account = *vector::borrow(&accounts, i);
        if (!vector::contains(&survey.allowlist, &account)) {
            vector::push_back(&mut survey.allowlist, account);
        };
        i = i + 1;
    };
}

/// 从allowlist移除
entry fun remove_from_allowlist(
    survey: &mut Survey,
    cap: &SurveyCap,
    account: address,
) {
    assert!(cap.survey_id == object::id(survey), EInvalidCap);
    
    let (exists, index) = vector::index_of(&survey.allowlist, &account);
    if (exists) {
        vector::remove(&mut survey.allowlist, index);
    };
}

// =================== 订阅与自动分红 ===================

/// 启用订阅模式
entry fun enable_subscription(
    survey: &mut Survey,
    cap: &SurveyCap,
    fee: u64,
    ttl: u64,
) {
    assert!(cap.survey_id == object::id(survey), EInvalidCap);
    
    survey.subscription_enabled = true;
    survey.subscription_fee = fee;
    survey.subscription_ttl = ttl;
}

/// 购买订阅并自动触发分红（内部函数）
fun subscribe_with_auto_dividend_internal(
    payment: Coin<SUI>,
    survey: &mut Survey,
    treasury: &mut PlatformTreasury,
    c: &Clock,
    ctx: &mut TxContext,
): SurveySubscription {
    assert!(survey.subscription_enabled, ENoAccess);
    let payment_amount = coin::value(&payment);
    assert!(payment_amount >= survey.subscription_fee, EInvalidFee);
    
    let subscriber = ctx.sender();
    let current_time = c.timestamp_ms();
    let expires_at = current_time + survey.subscription_ttl;
    
    // 收入进入收益池
    balance::join(&mut survey.revenue_pool, coin::into_balance(payment));
    survey.total_revenue = survey.total_revenue + payment_amount;
    
    // 记录订阅
    if (table::contains(&survey.subscribers, subscriber)) {
        *table::borrow_mut(&mut survey.subscribers, subscriber) = current_time;
    } else {
        table::add(&mut survey.subscribers, subscriber, current_time);
    };
    
    // 发出订阅事件
    event::emit(SubscriptionPurchasedEvent {
        survey_id: object::id(survey),
        subscriber,
        fee: payment_amount,
        expires_at,
    });
    
    // 【关键】自动尝试执行分红
    try_distribute_dividends(survey, treasury, current_time, ctx);
    
    // 返回订阅凭证
    SurveySubscription {
        id: object::new(ctx),
        survey_id: object::id(survey),
        subscriber,
        subscribed_at: current_time,
        expires_at,
    }
}

/// Entry函数：购买订阅
entry fun subscribe_entry(
    payment: Coin<SUI>,
    survey: &mut Survey,
    treasury: &mut PlatformTreasury,
    c: &Clock,
    ctx: &mut TxContext,
) {
    let subscription = subscribe_with_auto_dividend_internal(
        payment, survey, treasury, c, ctx
    );
    transfer::transfer(subscription, ctx.sender());
}

// =================== 自动分红机制 ===================

/// 尝试执行分红（内部函数）
fun try_distribute_dividends(
    survey: &mut Survey,
    treasury: &mut PlatformTreasury,
    current_time: u64,
    ctx: &mut TxContext,
) {
    let pool_balance = balance::value(&survey.revenue_pool);
    
    // 检查是否满足分红条件
    let time_passed = current_time - survey.last_dividend_time >= survey.min_dividend_interval;
    let amount_sufficient = pool_balance >= survey.dividend_threshold;
    
    if (!time_passed || !amount_sufficient || !survey.revenue_sharing_enabled) {
        return  // 不满足条件，直接返回
    };
    
    // 执行分红
    let total_amount = pool_balance;
    
    // 计算各方份额
    let creator_amount = (total_amount * survey.creator_share_ratio) / HUNDRED_PERCENT;
    let respondent_total = (total_amount * survey.respondent_share_ratio) / HUNDRED_PERCENT;
    let platform_amount = (total_amount * survey.platform_share_ratio) / HUNDRED_PERCENT;
    
    // 1. 创建者立即获得
    if (creator_amount > 0) {
        let creator_payment = coin::take(&mut survey.revenue_pool, creator_amount, ctx);
        transfer::public_transfer(creator_payment, survey.creator);
    };
    
    // 2. 平台费用进入金库
    if (platform_amount > 0) {
        let platform_fee = coin::take(&mut survey.revenue_pool, platform_amount, ctx);
        balance::join(&mut treasury.balance, coin::into_balance(platform_fee));
        treasury.total_fees_collected = treasury.total_fees_collected + platform_amount;
    };
    
    // 3. 答题者分红 - 遍历授权用户列表
    let authorized_count = vector::length(&survey.authorized_users);
    if (authorized_count > 0 && respondent_total > 0) {
        let per_user_amount = respondent_total / authorized_count;
        
        // 从收益池转到分红储备池
        let reserved = coin::take(&mut survey.revenue_pool, respondent_total, ctx);
        balance::join(&mut survey.dividend_reserve, coin::into_balance(reserved));
        
        // 遍历所有授权用户，记录待领取金额
        let mut i = 0;
        while (i < authorized_count) {
            let user = *vector::borrow(&survey.authorized_users, i);
            
            if (table::contains(&survey.pending_dividends, user)) {
                let balance = table::borrow_mut(&mut survey.pending_dividends, user);
                *balance = *balance + per_user_amount;
            } else {
                table::add(&mut survey.pending_dividends, user, per_user_amount);
            };
            
            i = i + 1;
        };
    };
    
    // 更新分红记录
    survey.last_dividend_time = current_time;
    survey.distributed_revenue = survey.distributed_revenue + total_amount;
    
    // 发出事件
    event::emit(DividendDistributedEvent {
        survey_id: object::id(survey),
        total_amount,
        creator_share: creator_amount,
        respondent_share: respondent_total,
        platform_share: platform_amount,
        authorized_count,
        timestamp: current_time,
    });
}

/// 用户领取分红
public fun claim_dividend(
    survey: &mut Survey,
    ctx: &mut TxContext,
): Coin<SUI> {
    let user = ctx.sender();
    
    assert!(table::contains(&survey.pending_dividends, user), ENoDividend);
    
    let amount = table::remove(&mut survey.pending_dividends, user);
    assert!(amount > 0, ENoDividend);
    
    // 从储备池提取
    let payment = coin::take(&mut survey.dividend_reserve, amount, ctx);
    
    // 更新用户总收益
    if (table::contains(&survey.answers, user)) {
        let answer_set = table::borrow_mut(&mut survey.answers, user);
        answer_set.total_earnings = answer_set.total_earnings + amount;
    };
    
    event::emit(DividendClaimedEvent {
        survey_id: object::id(survey),
        user,
        amount,
        timestamp: ctx.epoch_timestamp_ms(),
    });
    
    payment
}

/// Entry函数：领取分红
entry fun claim_dividend_entry(
    survey: &mut Survey,
    ctx: &mut TxContext,
) {
    let dividend = claim_dividend(survey, ctx);
    transfer::public_transfer(dividend, ctx.sender());
}

// =================== 问卷管理功能 ===================

/// 修改问卷标题
entry fun update_survey_title(
    survey: &mut Survey,
    cap: &SurveyCap,
    new_title: String,
    ctx: &TxContext,
) {
    assert!(cap.survey_id == object::id(survey), EInvalidCap);
    survey.title = new_title;
    
    event::emit(SurveyUpdatedEvent {
        survey_id: object::id(survey),
        update_type: b"title".to_string(),
        timestamp: ctx.epoch_timestamp_ms(),
    });
}

/// 修改问卷描述
entry fun update_survey_description(
    survey: &mut Survey,
    cap: &SurveyCap,
    new_description: String,
    ctx: &TxContext,
) {
    assert!(cap.survey_id == object::id(survey), EInvalidCap);
    survey.description = new_description;
    
    event::emit(SurveyUpdatedEvent {
        survey_id: object::id(survey),
        update_type: b"description".to_string(),
        timestamp: ctx.epoch_timestamp_ms(),
    });
}

/// 修改问卷问题列表（仅在无人答题时可修改）
entry fun update_survey_questions(
    survey: &mut Survey,
    cap: &SurveyCap,
    new_questions: vector<String>,
    ctx: &TxContext,
) {
    assert!(cap.survey_id == object::id(survey), EInvalidCap);
    // 只有在还没有人答题时才能修改问题
    assert!(survey.answer_count == 0, ESurveyCompleted);
    survey.questions = new_questions;
    
    event::emit(SurveyUpdatedEvent {
        survey_id: object::id(survey),
        update_type: b"questions".to_string(),
        timestamp: ctx.epoch_timestamp_ms(),
    });
}

/// 修改奖励金额（仅在无人答题时可修改）
entry fun update_reward_per_response(
    survey: &mut Survey,
    cap: &SurveyCap,
    new_reward: u64,
    ctx: &TxContext,
) {
    assert!(cap.survey_id == object::id(survey), EInvalidCap);
    // 只有在还没有人答题时才能修改奖励
    assert!(survey.answer_count == 0, ESurveyCompleted);
    // 确保奖励池足够支持新的奖励金额
    assert!(
        balance::value(&survey.reward_pool) >= new_reward * 10,
        EInsufficientInitialPool
    );
    survey.reward_per_response = new_reward;
    
    event::emit(SurveyUpdatedEvent {
        survey_id: object::id(survey),
        update_type: b"reward".to_string(),
        timestamp: ctx.epoch_timestamp_ms(),
    });
}

/// 修改订阅费用和有效期
entry fun update_subscription_settings(
    survey: &mut Survey,
    cap: &SurveyCap,
    new_fee: u64,
    new_ttl: u64,
    ctx: &TxContext,
) {
    assert!(cap.survey_id == object::id(survey), EInvalidCap);
    survey.subscription_fee = new_fee;
    survey.subscription_ttl = new_ttl;
    
    event::emit(SurveyUpdatedEvent {
        survey_id: object::id(survey),
        update_type: b"subscription".to_string(),
        timestamp: ctx.epoch_timestamp_ms(),
    });
}

/// 修改分红阈值和间隔
entry fun update_dividend_settings(
    survey: &mut Survey,
    cap: &SurveyCap,
    new_threshold: u64,
    new_interval_hours: u64,
    ctx: &TxContext,
) {
    assert!(cap.survey_id == object::id(survey), EInvalidCap);
    survey.dividend_threshold = new_threshold;
    survey.min_dividend_interval = new_interval_hours * 3600 * 1000;
    
    event::emit(SurveyUpdatedEvent {
        survey_id: object::id(survey),
        update_type: b"dividend".to_string(),  
        timestamp: ctx.epoch_timestamp_ms(),
    });
}

/// 切换自动关闭设置
entry fun toggle_auto_close(
    survey: &mut Survey,
    cap: &SurveyCap,
    auto_close: bool,
    ctx: &TxContext,
) {
    assert!(cap.survey_id == object::id(survey), EInvalidCap);
    survey.auto_close_on_empty_rewards = auto_close;
    
    event::emit(SurveyUpdatedEvent {
        survey_id: object::id(survey),
        update_type: b"auto_close".to_string(),
        timestamp: ctx.epoch_timestamp_ms(),
    });
}

/// 关闭问卷
entry fun close_survey(
    survey: &mut Survey,
    cap: &SurveyCap,
    c: &Clock,
) {
    assert!(cap.survey_id == object::id(survey), EInvalidCap);
    survey.is_active = false;
    survey.closed_at = option::some(c.timestamp_ms());
}

/// 重新开启问卷
entry fun reopen_survey(
    survey: &mut Survey,
    cap: &SurveyCap,
) {
    assert!(cap.survey_id == object::id(survey), EInvalidCap);
    survey.is_active = true;
    survey.closed_at = option::none();
}

/// 补充奖励池
entry fun add_to_reward_pool(
    survey: &mut Survey,
    cap: &SurveyCap,
    additional_rewards: Coin<SUI>,
) {
    assert!(cap.survey_id == object::id(survey), EInvalidCap);
    balance::join(&mut survey.reward_pool, coin::into_balance(additional_rewards));
}

/// 提取剩余奖励（仅在问卷关闭后）
entry fun withdraw_remaining_rewards(
    survey: &mut Survey,
    cap: &SurveyCap,
    ctx: &mut TxContext,
) {
    assert!(cap.survey_id == object::id(survey), EInvalidCap);
    assert!(!survey.is_active, ENoAccess);
    
    let amount = balance::value(&survey.reward_pool);
    if (amount > 0) {
        let payment = coin::take(&mut survey.reward_pool, amount, ctx);
        transfer::public_transfer(payment, survey.creator);
    }
}

// =================== 访问控制（与Seal集成）===================

/// 获取namespace用于加密ID前缀
public fun namespace(survey: &Survey): vector<u8> {
    object::id_to_bytes(&object::id(survey))
}

/// 检查前缀匹配
fun is_prefix(prefix: vector<u8>, data: vector<u8>): bool {
    let prefix_len = vector::length(&prefix);
    if (prefix_len > vector::length(&data)) {
        return false
    };
    
    let mut i = 0;
    while (i < prefix_len) {
        if (*vector::borrow(&prefix, i) != *vector::borrow(&data, i)) {
            return false
        };
        i = i + 1;
    };
    true
}

/// Seal授权 - Allowlist模式
entry fun seal_approve_allowlist(
    id: vector<u8>,
    survey: &Survey,
    ctx: &TxContext,
) {
    assert!(is_prefix(namespace(survey), id), ENoAccess);
    
    let caller = ctx.sender();
    assert!(
        vector::contains(&survey.allowlist, &caller) || 
        caller == survey.creator,
        ENoAccess
    );
}

/// Seal授权 - 订阅模式
entry fun seal_approve_subscription(
    id: vector<u8>,
    subscription: &SurveySubscription,
    survey: &Survey,
    c: &Clock,
) {
    assert!(is_prefix(namespace(survey), id), ENoAccess);
    assert!(subscription.survey_id == object::id(survey), ENoAccess);
    assert!(c.timestamp_ms() < subscription.expires_at, ENoAccess);
}

// =================== 查询功能 ===================

/// 获取问卷基本信息
public fun get_survey_info(survey: &Survey): (String, String, u64, bool) {
    (
        survey.title,
        survey.description,
        survey.answer_count,
        survey.is_active
    )
}

/// 获取问题列表
public fun get_questions(survey: &Survey): vector<String> {
    survey.questions
}

/// 获取答案数量
public fun get_answer_count(survey: &Survey): u64 {
    survey.answer_count
}

/// 检查用户是否已提交答案
public fun has_answered(survey: &Survey, respondent: address): bool {
    table::contains(&survey.answers, respondent)
}

/// 获取用户收益信息
public fun get_user_earnings(
    survey: &Survey,
    user: address,
): (u64, u64, bool) {  // (总收益, 待领取分红, 是否已领取填写奖励)
    let mut total_earnings = 0u64;
    let mut reward_claimed = false;
    
    if (table::contains(&survey.answers, user)) {
        let answer_set = table::borrow(&survey.answers, user);
        total_earnings = answer_set.total_earnings;
        reward_claimed = answer_set.reward_amount > 0;
    };
    
    let pending_dividend = if (table::contains(&survey.pending_dividends, user)) {
        *table::borrow(&survey.pending_dividends, user)
    } else {
        0
    };
    
    (total_earnings, pending_dividend, reward_claimed)
}

/// 获取问卷激励统计
public fun get_incentive_stats(survey: &Survey): (u64, u64, u64, u64, u64) {
    (
        balance::value(&survey.reward_pool),      // 奖励池余额
        survey.total_reward_distributed,          // 已分发奖励
        survey.total_revenue,                     // 总收入
        survey.distributed_revenue,               // 已分配收入
        survey.authorized_count                   // 授权分享数量
    )
}

/// 获取收益分配比例
public fun get_revenue_sharing_ratios(survey: &Survey): (u64, u64, u64) {
    (
        survey.creator_share_ratio,
        survey.respondent_share_ratio,
        survey.platform_share_ratio
    )
}

/// 检查是否有权限查看答案
public fun can_view_answers(
    survey: &Survey,
    viewer: address,
    c: &Clock,
): bool {
    // 创建者总是可以查看
    if (viewer == survey.creator) {
        return true
    };
    
    // 在allowlist中
    if (vector::contains(&survey.allowlist, &viewer)) {
        return true
    };
    
    // 有有效订阅
    if (survey.subscription_enabled && table::contains(&survey.subscribers, viewer)) {
        let subscribed_at = *table::borrow(&survey.subscribers, viewer);
        if (c.timestamp_ms() < subscribed_at + survey.subscription_ttl) {
            return true
        };
    };
    
    false
}

/// 检查奖励池状态
public fun check_reward_pool_status(survey: &Survey): (u64, u64, bool) {
    let balance = balance::value(&survey.reward_pool);
    let remaining_responses = if (survey.reward_per_response > 0) {
        balance / survey.reward_per_response
    } else {
        999999
    };
    let has_sufficient = balance >= survey.reward_per_response;
    
    (balance, remaining_responses, has_sufficient)
}

/// 获取下次分红信息
#[allow(unused_variable)]
public fun get_next_dividend_info(survey: &Survey, c: &Clock): (u64, u64, u64) {
    let next_time = survey.last_dividend_time + survey.min_dividend_interval;
    let current_pool = balance::value(&survey.revenue_pool);
    let needed_amount = if (current_pool >= survey.dividend_threshold) {
        0
    } else {
        survey.dividend_threshold - current_pool
    };
    
    (
        next_time,           // 下次可分红时间
        current_pool,        // 当前池余额
        needed_amount        // 还需要多少触发分红
    )
}

/// 获取待领取分红
public fun get_pending_dividend(survey: &Survey, user: address): u64 {
    if (table::contains(&survey.pending_dividends, user)) {
        *table::borrow(&survey.pending_dividends, user)
    } else {
        0
    }
}

/// 获取平台金库信息
public fun get_treasury_info(treasury: &PlatformTreasury): (u64, u64, address) {
    (
        balance::value(&treasury.balance),
        treasury.total_fees_collected,
        treasury.admin
    )
}

/// 获取订阅信息
public fun get_subscription_info(
    survey: &Survey,
    user: address,
    c: &Clock
): (bool, u64) {  // (是否有效, 剩余时间)
    if (survey.subscription_enabled && table::contains(&survey.subscribers, user)) {
        let subscribed_at = *table::borrow(&survey.subscribers, user);
        let expires_at = subscribed_at + survey.subscription_ttl;
        let current_time = c.timestamp_ms();
        
        if (current_time < expires_at) {
            (true, expires_at - current_time)
        } else {
            (false, 0)
        }
    } else {
        (false, 0)
    }
}

// =================== 注册表查询功能 ===================

/// 获取创建者的所有问卷
public fun get_creator_surveys(
    registry: &SurveyRegistry,
    creator: address,
): vector<ID> {
    if (table::contains(&registry.creator_surveys, creator)) {
        *table::borrow(&registry.creator_surveys, creator)
    } else {
        vector::empty()
    }
}

/// 获取分类下的问卷
public fun get_surveys_by_category(
    registry: &SurveyRegistry,
    category: String,
): vector<ID> {
    if (table::contains(&registry.surveys_by_category, category)) {
        *table::borrow(&registry.surveys_by_category, category)
    } else {
        vector::empty()
    }
}

/// 检查创建者是否被封禁
public fun is_creator_banned(
    registry: &SurveyRegistry,
    creator: address,
): bool {
    vec_set::contains(&registry.banned_creators, &creator)
}

/// 封禁问卷（管理员）
entry fun ban_survey(
    _admin_cap: &PlatformAdminCap,
    registry: &mut SurveyRegistry,
    survey: &mut Survey,
    survey_id: ID,
) {
    vec_set::insert(&mut registry.banned_surveys, survey_id);
    
    if (table::contains(&registry.all_surveys, survey_id)) {
        let meta = table::borrow_mut(&mut registry.all_surveys, survey_id);
        meta.is_banned = true;
        meta.is_active = false;
        
        if (registry.active_surveys > 0) {
            registry.active_surveys = registry.active_surveys - 1;
        };
    };
    
    // 同时更新survey对象
    survey.is_active = false;
}

/// 封禁创建者（管理员）
entry fun ban_creator(
    _admin_cap: &PlatformAdminCap,
    registry: &mut SurveyRegistry,
    creator: address,
) {
    vec_set::insert(&mut registry.banned_creators, creator);
    
    // 暂停该创建者的所有问卷
    if (table::contains(&registry.creator_surveys, creator)) {
        let survey_ids = table::borrow(&registry.creator_surveys, creator);
        let mut i = 0;
        
        while (i < vector::length(survey_ids)) {
            let survey_id = *vector::borrow(survey_ids, i);
            
            if (table::contains(&registry.all_surveys, survey_id)) {
                let meta = table::borrow_mut(&mut registry.all_surveys, survey_id);
                if (meta.is_active) {
                    meta.is_active = false;
                    registry.active_surveys = registry.active_surveys - 1;
                };
            };
            
            i = i + 1;
        };
    };
}