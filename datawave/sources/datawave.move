// Copyright (c), DataWave Survey System with Automatic Incentive & Revenue Sharing
// SPDX-License-Identifier: Apache-2.0

module datawave::survey_system;

use std::string::String;
use sui::{
    table::{Self, Table},
    balance::{Self, Balance},
    clock::Clock,
    coin::{Self, Coin},
    sui::SUI,
    event
};

// =================== 错误码 ===================
const EInvalidCap: u64 = 0;
const ENoAccess: u64 = 1;
const EDuplicate: u64 = 2;
const EInvalidFee: u64 = 3;
const ESurveyCompleted: u64 = 4;
const EAlreadyAnswered: u64 = 5;
const ENotAuthorized: u64 = 6;
const EInsufficientReward: u64 = 7;
const ENoDividend: u64 = 8;
const EInvalidRatio: u64 = 9;
const EInsufficientInitialPool: u64 = 10;

// =================== 常量 ===================
const HUNDRED_PERCENT: u64 = 10000; // 100.00% 用基点表示
const MAX_CREATOR_SHARE: u64 = 4000; // 创建者最多40%
const MIN_RESPONDENT_SHARE: u64 = 5000; // 答题者至少50%
const MIN_PLATFORM_SHARE: u64 = 500; // 平台至少5%
const PLATFORM_ADDRESS: address = @0xPLATFORM; // 平台地址（需要配置）

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

// =================== 问卷创建 ===================

/// 创建带激励和收益分享的问卷
public fun create_survey_with_incentive(
    title: String,
    description: String,
    questions: vector<String>,
    reward_per_response: u64,
    initial_reward_pool: Coin<SUI>,
    // 分红设置
    dividend_threshold: u64,      // 触发分红的金额阈值
    min_interval_hours: u64,      // 最小分红间隔（小时）
    creator_ratio: u64,           // 创建者分成比例
    respondent_ratio: u64,        // 答题者分成比例
    auto_close_on_empty: bool,    // 奖励用完时自动关闭
    c: &Clock,
    ctx: &mut TxContext,
): SurveyCap {
    let creator = ctx.sender();
    let pool_value = coin::value(&initial_reward_pool);
    
    // 验证初始奖励池足够
    assert!(
        pool_value >= reward_per_response * 10,  // 至少支持10个回答
        EInsufficientInitialPool
    );
    
    // 计算平台分成比例
    let platform_ratio = HUNDRED_PERCENT - creator_ratio - respondent_ratio;
    
    // 验证比例合理
    assert!(creator_ratio <= MAX_CREATOR_SHARE, EInvalidRatio);
    assert!(respondent_ratio >= MIN_RESPONDENT_SHARE, EInvalidRatio);
    assert!(platform_ratio >= MIN_PLATFORM_SHARE, EInvalidRatio);
    
    let mut survey = Survey {
        id: object::new(ctx),
        title,
        description,
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
        
        // 激励机制
        reward_pool: coin::into_balance(initial_reward_pool),
        reward_per_response,
        total_reward_distributed: 0,
        
        // 收益分享（比例锁定，不可更改）
        revenue_sharing_enabled: true,
        creator_share_ratio: creator_ratio,
        respondent_share_ratio: respondent_ratio,
        platform_share_ratio: platform_ratio,
        
        // 收益管理
        revenue_pool: balance::zero(),
        dividend_reserve: balance::zero(),
        total_revenue: 0,
        distributed_revenue: 0,
        
        // 分红设置
        dividend_threshold,
        last_dividend_time: c.timestamp_ms(),
        min_dividend_interval: min_interval_hours * 3600 * 1000,
        
        pending_dividends: table::new(ctx),
    };
    
    let survey_id = object::id(&survey);
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
    reward_per_response: u64,
    initial_reward_pool: Coin<SUI>,
    dividend_threshold: u64,
    min_interval_hours: u64,
    creator_ratio: u64,
    respondent_ratio: u64,
    auto_close: bool,
    c: &Clock,
    ctx: &mut TxContext,
) {
    let cap = create_survey_with_incentive(
        title, description, questions,
        reward_per_response, initial_reward_pool,
        dividend_threshold, min_interval_hours,
        creator_ratio, respondent_ratio,
        auto_close, c, ctx
    );
    transfer::transfer(cap, ctx.sender());
}

// =================== 答案提交（自动发放奖励）===================

/// 提交答案并自动发放奖励
public fun submit_answer_with_auto_reward(
    survey: &mut Survey,
    encrypted_blob_id: String,
    authorize_sharing: bool,
    c: &Clock,
    ctx: &mut TxContext,
): Option<Coin<SUI>> {
    let respondent = ctx.sender();
    
    // 检查问卷状态
    assert!(survey.is_active, ESurveyCompleted);
    assert!(!table::contains(&survey.answers, respondent), EAlreadyAnswered);
    
    // 检查并发放奖励
    let reward_coin = if (balance::value(&survey.reward_pool) >= survey.reward_per_response) {
        let reward = coin::take(&mut survey.reward_pool, survey.reward_per_response, ctx);
        survey.total_reward_distributed = survey.total_reward_distributed + survey.reward_per_response;
        option::some(reward)
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
        option::none()
    };
    
    let actual_reward = if (option::is_some(&reward_coin)) {
        survey.reward_per_response
    } else {
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
    
    reward_coin
}

/// Entry函数：提交答案（奖励直接转给用户）
entry fun submit_answer_entry(
    survey: &mut Survey,
    encrypted_blob_id: String,
    authorize_sharing: bool,
    c: &Clock,
    ctx: &mut TxContext,
) {
    let reward_opt = submit_answer_with_auto_reward(
        survey,
        encrypted_blob_id,
        authorize_sharing,
        c,
        ctx
    );
    
    // 如果有奖励，直接转给用户
    if (option::is_some(&reward_opt)) {
        let reward = option::destroy_some(reward_opt);
        transfer::public_transfer(reward, ctx.sender());
    };
}

/// 更新已提交的答案
public fun update_answer_set(
    survey: &mut Survey,
    new_encrypted_blob_id: String,
    c: &Clock,
    ctx: &mut TxContext,
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
public fun add_to_allowlist(
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
public fun batch_add_to_allowlist(
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
public fun remove_from_allowlist(
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
public fun enable_subscription(
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

/// 购买订阅并自动触发分红
public fun subscribe_with_auto_dividend(
    payment: Coin<SUI>,
    survey: &mut Survey,
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
    try_distribute_dividends(survey, current_time, ctx);
    
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
    c: &Clock,
    ctx: &mut TxContext,
) {
    let subscription = subscribe_with_auto_dividend(payment, survey, c, ctx);
    transfer::transfer(subscription, ctx.sender());
}

// =================== 自动分红机制 ===================

/// 尝试执行分红（内部函数）
fun try_distribute_dividends(
    survey: &mut Survey,
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
    
    // 2. 平台立即获得
    if (platform_amount > 0) {
        let platform_payment = coin::take(&mut survey.revenue_pool, platform_amount, ctx);
        transfer::public_transfer(platform_payment, PLATFORM_ADDRESS);
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

/// 关闭问卷
public fun close_survey(
    survey: &mut Survey,
    cap: &SurveyCap,
    c: &Clock,
) {
    assert!(cap.survey_id == object::id(survey), EInvalidCap);
    survey.is_active = false;
    survey.closed_at = option::some(c.timestamp_ms());
}

/// 重新开启问卷
public fun reopen_survey(
    survey: &mut Survey,
    cap: &SurveyCap,
) {
    assert!(cap.survey_id == object::id(survey), EInvalidCap);
    survey.is_active = true;
    survey.closed_at = option::none();
}

/// 补充奖励池
public fun add_to_reward_pool(
    survey: &mut Survey,
    cap: &SurveyCap,
    additional_rewards: Coin<SUI>,
) {
    assert!(cap.survey_id == object::id(survey), EInvalidCap);
    balance::join(&mut survey.reward_pool, coin::into_balance(additional_rewards));
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
    let total_earnings = 0u64;
    let reward_claimed = false;
    
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
public fun get_next_dividend_info(survey: &Survey, c: &Clock): (u64, u64, u64) {
    let current_time = c.timestamp_ms();
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