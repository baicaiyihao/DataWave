// Copyright (c) 2025, DataWave Survey Platform
// SPDX-License-Identifier: Apache-2.0

module datawave::survey_system;

use std::string::{String, utf8};
use sui::table::{Self, Table};
use sui::vec_set::{Self, VecSet};
use sui::dynamic_field as df;
use sui::event;
use sui::coin::{Self, Coin};
use sui::sui::SUI;
use sui::clock::{Self, Clock};
use datawave::utils::is_prefix;

// ======== Constants ========
const EInvalidOwner: u64 = 0;
const ESurveyNotFound: u64 = 1;
const EAlreadyAnswered: u64 = 2;
const EInsufficientPayment: u64 = 3;
const ENotInAllowlist: u64 = 4;
const ESubscriptionExpired: u64 = 6;
const ESurveyNotActive: u64 = 7;
const EDuplicateInAllowlist: u64 = 9;

// Marker for blob storage (following Seal demo pattern)
const MARKER: u64 = 3;

// ======== Structs ========

/// Main survey object created by merchant
public struct Survey has key, store {
    id: UID,
    creator: address,
    title: String,
    description: String,
    category: String,
    questions: vector<Question>,
    reward_per_response: u64,
    max_responses: u64,
    current_responses: u64,
    created_at: u64,
    updated_at: u64,
    is_active: bool,
    // Allowlist for direct access to decrypt answers
    allowlist: VecSet<address>,
    // Table to track who has answered
    respondents: Table<address, bool>,
    // Store encrypted answer blob IDs instead of raw data
    encrypted_answer_blobs: Table<address, EncryptedAnswerBlob>,
    // Track number of users who consented for subscription
    consenting_users_count: u64,
    // Track addresses of consenting users for dividend distribution
    consenting_users: vector<address>,
}

/// Individual question in a survey
#[allow(unused_field)]
public struct Question has store, copy, drop {
    question_text: String,
    question_type: u8, // 0: single choice, 1: multiple choice, 2: text
    options: vector<String>, // Empty for text questions
}

/// Encrypted answer blob reference
public struct EncryptedAnswerBlob has store {
    respondent: address,
    // Walrus blob ID where encrypted answer is stored
    blob_id: String,
    // Seal key ID for decryption
    seal_key_id: String,
    submitted_at: u64,
    // User consent for subscription access
    consent_for_subscription: bool,
}

/// Global registry for all surveys
public struct SurveyRegistry has key {
    id: UID,
    // All surveys in the platform (survey_id -> basic_info)
    all_surveys: Table<ID, SurveyBasicInfo>,
    // Surveys by creator (creator_address -> vector of survey_ids)
    surveys_by_creator: Table<address, vector<ID>>,
    // Active surveys for easy discovery
    active_surveys: Table<ID, bool>,
    // Category index (category -> vector of survey_ids)
    surveys_by_category: Table<String, vector<ID>>,
    // Total statistics
    total_surveys: u64,
    total_responses: u64,
    total_rewards_distributed: u64,
}

/// Basic survey info for registry
public struct SurveyBasicInfo has store, drop {
    creator: address,
    title: String,
    description: String,
    category: String,
    created_at: u64,
    is_active: bool,
    current_responses: u64,
    max_responses: u64,
    reward_per_response: u64,
}

/// Capability for survey management
public struct SurveyCap has key, store {
    id: UID,
    survey_id: ID,
}

/// Subscription service for accessing survey data
public struct SubscriptionService has key, store {
    id: UID,
    survey_id: ID,
    price: u64, // Price in MIST
    duration_ms: u64, // Duration in milliseconds
    creator: address,
    total_revenue: u64,
    // Track subscribers
    subscribers: Table<address, Subscription>,
}

/// Individual subscription NFT
public struct Subscription has key, store {
    id: UID,
    service_id: ID,
    survey_id: ID,
    subscriber: address,
    created_at: u64,
    expires_at: u64,
}

/// Platform treasury for managing fees
public struct PlatformTreasury has key {
    id: UID,
    total_fees: u64,
    platform_fee_rate: u64, // Basis points (e.g., 250 = 2.5%)
}

/// Admin capability
public struct AdminCap has key, store {
    id: UID,
}

// ======== Events ========

public struct SurveyCreated has copy, drop {
    survey_id: ID,
    creator: address,
    title: String,
    reward_per_response: u64,
}

public struct SurveyAnswered has copy, drop {
    survey_id: ID,
    respondent: address,
    blob_id: String,
    reward_paid: u64,
    consent_given: bool,
}

public struct SubscriptionPurchased has copy, drop {
    survey_id: ID,
    subscriber: address,
    price: u64,
    expires_at: u64,
}

public struct DividendDistributed has copy, drop {
    survey_id: ID,
    total_amount: u64,
    num_recipients: u64,
}

// ======== Initialization ========

fun init(ctx: &mut TxContext) {
    // Create platform treasury
    let treasury = PlatformTreasury {
        id: object::new(ctx),
        total_fees: 0,
        platform_fee_rate: 250, // 2.5% platform fee
    };
    transfer::share_object(treasury);
    
    // Create survey registry
    let registry = SurveyRegistry {
        id: object::new(ctx),
        all_surveys: table::new(ctx),
        surveys_by_creator: table::new(ctx),
        active_surveys: table::new(ctx),
        surveys_by_category: table::new(ctx),
        total_surveys: 0,
        total_responses: 0,
        total_rewards_distributed: 0,
    };
    transfer::share_object(registry);

    // Create admin capability
    let admin_cap = AdminCap {
        id: object::new(ctx),
    };
    transfer::transfer(admin_cap, ctx.sender());
}

// ======== Merchant Functions ========

/// Create a new survey
public fun create_survey(
    title: String,
    description: String,
    category: String,
    questions: vector<Question>,
    reward_per_response: u64,
    max_responses: u64,
    payment: Coin<SUI>,
    registry: &mut SurveyRegistry,
    clock: &Clock,
    ctx: &mut TxContext,
): SurveyCap {
    // Ensure merchant has enough funds for rewards
    let total_rewards = reward_per_response * max_responses;
    assert!(coin::value(&payment) >= total_rewards, EInsufficientPayment);

    let creator = ctx.sender();
    let created_at = clock::timestamp_ms(clock);
    
    let mut survey = Survey {
        id: object::new(ctx),
        creator,
        title,
        description,
        category,
        questions,
        reward_per_response,
        max_responses,
        current_responses: 0,
        created_at,
        updated_at: created_at,
        is_active: true,
        allowlist: vec_set::empty(),
        respondents: table::new(ctx),
        encrypted_answer_blobs: table::new(ctx),
        consenting_users_count: 0,
        consenting_users: vector::empty(),
    };

    // Add creator to allowlist by default
    vec_set::insert(&mut survey.allowlist, creator);

    let survey_id = object::id(&survey);
    
    // Create basic info
    let basic_info = SurveyBasicInfo {
        creator,
        title: survey.title,
        description: survey.description,
        category: survey.category,
        created_at,
        is_active: true,
        current_responses: 0,
        max_responses,
        reward_per_response,
    };
    
    // Register survey
    table::add(&mut registry.all_surveys, survey_id, basic_info);
    table::add(&mut registry.active_surveys, survey_id, true);
    
    // Add to creator's surveys
    if (!table::contains(&registry.surveys_by_creator, creator)) {
        table::add(&mut registry.surveys_by_creator, creator, vector::empty());
    };
    let creator_surveys = table::borrow_mut(&mut registry.surveys_by_creator, creator);
    vector::push_back(creator_surveys, survey_id);
    
    // Add to category index
    if (!table::contains(&registry.surveys_by_category, survey.category)) {
        table::add(&mut registry.surveys_by_category, survey.category, vector::empty());
    };
    let category_surveys = table::borrow_mut(&mut registry.surveys_by_category, survey.category);
    vector::push_back(category_surveys, survey_id);
    
    registry.total_surveys = registry.total_surveys + 1;
    
    // Store the payment for rewards
    df::add(&mut survey.id, b"reward_pool", payment);

    let cap = SurveyCap {
        id: object::new(ctx),
        survey_id,
    };

    event::emit(SurveyCreated {
        survey_id,
        creator,
        title: survey.title,
        reward_per_response,
    });

    transfer::share_object(survey);
    cap
}

/// Submit survey answer (now stores blob ID instead of raw data)
#[allow(lint(self_transfer))]
public fun submit_answer(
    survey: &mut Survey,
    blob_id: String,  // Walrus blob ID of encrypted answer
    seal_key_id: String, // Seal key ID for decryption
    consent_for_subscription: bool,
    treasury: &mut PlatformTreasury,
    registry: &mut SurveyRegistry,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    let respondent = ctx.sender();
    
    // Check survey is active
    assert!(survey.is_active, ESurveyNotActive);
    assert!(survey.current_responses < survey.max_responses, ESurveyNotActive);
    
    // Check if user already answered
    assert!(!table::contains(&survey.respondents, respondent), EAlreadyAnswered);
    
    // Create encrypted answer blob reference
    let answer_blob = EncryptedAnswerBlob {
        respondent,
        blob_id,
        seal_key_id,
        submitted_at: clock::timestamp_ms(clock),
        consent_for_subscription,
    };
    
    // Store answer blob reference
    table::add(&mut survey.encrypted_answer_blobs, respondent, answer_blob);
    table::add(&mut survey.respondents, respondent, true);
    
    // Store blob ID as dynamic field (following Seal demo pattern)
    df::add(&mut survey.id, blob_id, MARKER);
    
    survey.current_responses = survey.current_responses + 1;
    
    // Track consenting users
    if (consent_for_subscription) {
        survey.consenting_users_count = survey.consenting_users_count + 1;
        vector::push_back(&mut survey.consenting_users, respondent);
    };
    
    // Update registry statistics
    registry.total_responses = registry.total_responses + 1;
    
    // Update survey basic info in registry
    let survey_id = object::id(survey);
    if (table::contains(&registry.all_surveys, survey_id)) {
        let info = table::borrow_mut(&mut registry.all_surveys, survey_id);
        info.current_responses = survey.current_responses;
    };
    
    // Pay reward to respondent
    let reward_pool = df::borrow_mut<vector<u8>, Coin<SUI>>(
        &mut survey.id, 
        b"reward_pool"
    );
    
    let reward_amount = survey.reward_per_response;
    let platform_fee = (reward_amount * treasury.platform_fee_rate) / 10000;
    let user_reward = reward_amount - platform_fee;
    
    registry.total_rewards_distributed = registry.total_rewards_distributed + user_reward;
    
    // Transfer reward to user
    let user_payment = coin::split(reward_pool, user_reward, ctx);
    transfer::public_transfer(user_payment, respondent);
    
    // Collect platform fee
    treasury.total_fees = treasury.total_fees + platform_fee;
    let platform_payment = coin::split(reward_pool, platform_fee, ctx);
    
    // Accumulate fees in treasury
    if (df::exists_(&treasury.id, b"accumulated_fees")) {
        let mut existing = df::remove<vector<u8>, Coin<SUI>>(&mut treasury.id, b"accumulated_fees");
        coin::join(&mut existing, platform_payment);
        df::add(&mut treasury.id, b"accumulated_fees", existing);
    } else {
        df::add(&mut treasury.id, b"accumulated_fees", platform_payment);
    };
    
    event::emit(SurveyAnswered {
        survey_id: object::id(survey),
        respondent,
        blob_id,
        reward_paid: user_reward,
        consent_given: consent_for_subscription,
    });
}

/// Toggle survey active status
public fun toggle_survey_status(
    survey: &mut Survey,
    cap: &SurveyCap,
    registry: &mut SurveyRegistry,
    clock: &Clock,
) {
    assert!(cap.survey_id == object::id(survey), EInvalidOwner);
    survey.is_active = !survey.is_active;
    survey.updated_at = clock::timestamp_ms(clock);
    
    let survey_id = object::id(survey);
    
    // Update status in registry
    if (table::contains(&registry.all_surveys, survey_id)) {
        let info = table::borrow_mut(&mut registry.all_surveys, survey_id);
        info.is_active = survey.is_active;
    };
    
    // Update active surveys table
    if (survey.is_active) {
        if (!table::contains(&registry.active_surveys, survey_id)) {
            table::add(&mut registry.active_surveys, survey_id, true);
        }
    } else {
        if (table::contains(&registry.active_surveys, survey_id)) {
            table::remove(&mut registry.active_surveys, survey_id);
        }
    };
}

/// Add address to allowlist (for decryption access)
public fun add_to_allowlist(
    survey: &mut Survey,
    cap: &SurveyCap,
    account: address,
) {
    assert!(cap.survey_id == object::id(survey), EInvalidOwner);
    assert!(!vec_set::contains(&survey.allowlist, &account), EDuplicateInAllowlist);
    vec_set::insert(&mut survey.allowlist, account);
}

/// Remove address from allowlist
public fun remove_from_allowlist(
    survey: &mut Survey,
    cap: &SurveyCap,
    account: address,
) {
    assert!(cap.survey_id == object::id(survey), EInvalidOwner);
    vec_set::remove(&mut survey.allowlist, &account);
}

/// Create subscription service for a survey
public fun create_subscription_service(
    survey: &Survey,
    cap: &SurveyCap,
    price: u64,
    duration_ms: u64,
    ctx: &mut TxContext,
) {
    assert!(cap.survey_id == object::id(survey), EInvalidOwner);
    
    let service = SubscriptionService {
        id: object::new(ctx),
        survey_id: object::id(survey),
        price,
        duration_ms,
        creator: survey.creator,
        total_revenue: 0,
        subscribers: table::new(ctx),
    };
    
    transfer::share_object(service);
}

/// Purchase subscription to access survey data
public fun purchase_subscription(
    service: &mut SubscriptionService,
    survey: &Survey,
    mut payment: Coin<SUI>,
    treasury: &mut PlatformTreasury,
    clock: &Clock,
    ctx: &mut TxContext,
): Subscription {
    let subscriber = ctx.sender();
    assert!(coin::value(&payment) == service.price, EInsufficientPayment);
    
    let created_at = clock::timestamp_ms(clock);
    let expires_at = created_at + service.duration_ms;
    
    // Create subscription NFT
    let subscription = Subscription {
        id: object::new(ctx),
        service_id: object::id(service),
        survey_id: service.survey_id,
        subscriber,
        created_at,
        expires_at,
    };
    
    // Calculate dividend distribution
    let platform_fee = (service.price * treasury.platform_fee_rate) / 10000;
    let creator_share = (service.price * 3000) / 10000; // 30% to creator
    let dividend_pool = service.price - platform_fee - creator_share;
    
    // Pay creator
    let creator_payment = coin::split(&mut payment, creator_share, ctx);
    transfer::public_transfer(creator_payment, service.creator);
    
    // Collect platform fee
    treasury.total_fees = treasury.total_fees + platform_fee;
    let platform_payment = coin::split(&mut payment, platform_fee, ctx);
    
    // Accumulate fees in treasury
    if (df::exists_(&treasury.id, b"accumulated_fees")) {
        let mut existing = df::remove<vector<u8>, Coin<SUI>>(&mut treasury.id, b"accumulated_fees");
        coin::join(&mut existing, platform_payment);
        df::add(&mut treasury.id, b"accumulated_fees", existing);
    } else {
        df::add(&mut treasury.id, b"accumulated_fees", platform_payment);
    };
    
    // Distribute dividends to consenting users
    distribute_dividends(survey, dividend_pool, payment, ctx);
    
    service.total_revenue = service.total_revenue + service.price;
    
    event::emit(SubscriptionPurchased {
        survey_id: service.survey_id,
        subscriber,
        price: service.price,
        expires_at,
    });
    
    subscription
}

// ======== Seal Integration Functions ========

/// Get namespace for Seal encryption - returns survey ID bytes
public fun survey_namespace(survey: &Survey): vector<u8> {
    object::id(survey).to_bytes()
}

/// Check if address has access to decrypt survey answers via allowlist
/// Key format: [survey_id][nonce] - matches Seal demo pattern
public fun seal_approve_allowlist(
    id: vector<u8>,
    survey: &Survey,
    ctx: &TxContext,
) {
    let caller = ctx.sender();
    
    // Check if the id has the right prefix (survey_id)
    let namespace = survey_namespace(survey);
    assert!(is_prefix(namespace, id), ENotInAllowlist);
    
    // Check if user is in allowlist
    assert!(vec_set::contains(&survey.allowlist, &caller), ENotInAllowlist);
}

/// Check if subscription is valid for accessing survey answers
/// Key format: [survey_id][nonce] - matches Seal demo pattern
public fun seal_approve_subscription(
    id: vector<u8>,
    subscription: &Subscription,
    service: &SubscriptionService,
    survey: &Survey,
    clock: &Clock,
    ctx: &TxContext,
) {
    let caller = ctx.sender();
    
    // Verify subscription ownership
    assert!(subscription.subscriber == caller, ENotInAllowlist);
    
    // Verify subscription matches service and survey
    assert!(subscription.service_id == object::id(service), ESubscriptionExpired);
    assert!(subscription.survey_id == object::id(survey), ESurveyNotFound);
    assert!(service.survey_id == object::id(survey), ESurveyNotFound);
    
    // Check if subscription is still valid
    assert!(clock::timestamp_ms(clock) < subscription.expires_at, ESubscriptionExpired);
    
    // Check if the id has the right prefix (survey_id)
    let namespace = survey_namespace(survey);
    assert!(is_prefix(namespace, id), ENotInAllowlist);
}

// ======== Helper Functions ========

/// Distribute dividends to users who gave consent
fun distribute_dividends(
    survey: &Survey,
    total_amount: u64,
    mut payment: Coin<SUI>,
    ctx: &mut TxContext,
) {
    let num_recipients = survey.consenting_users_count;
    
    if (num_recipients > 0) {
        let dividend_per_user = total_amount / num_recipients;
        let consenting_users = &survey.consenting_users;
        
        // Distribute dividends
        let mut i = 0;
        while (i < num_recipients) {
            let recipient = *vector::borrow(consenting_users, i);
            let dividend = coin::split(&mut payment, dividend_per_user, ctx);
            transfer::public_transfer(dividend, recipient);
            i = i + 1;
        };
        
        event::emit(DividendDistributed {
            survey_id: object::id(survey),
            total_amount,
            num_recipients,
        });
    };
    
    // Return remaining dust to creator if any
    if (coin::value(&payment) > 0) {
        transfer::public_transfer(payment, survey.creator);
    } else {
        coin::destroy_zero(payment);
    }
}

// ======== View Functions ========

/// Get survey details
public fun get_survey_info(survey: &Survey): (String, String, u64, u64, u64, bool) {
    (
        survey.title,
        survey.description,
        survey.reward_per_response,
        survey.max_responses,
        survey.current_responses,
        survey.is_active
    )
}

/// Get all encrypted answer blob IDs for a survey
public fun get_answer_blob_ids(survey: &Survey): vector<String> {
    let mut blob_ids = vector::empty<String>();
    let mut i = 0;
    let respondents = &survey.consenting_users;
    
    while (i < vector::length(respondents)) {
        let respondent = *vector::borrow(respondents, i);
        if (table::contains(&survey.encrypted_answer_blobs, respondent)) {
            let answer_blob = table::borrow(&survey.encrypted_answer_blobs, respondent);
            vector::push_back(&mut blob_ids, answer_blob.blob_id);
        };
        i = i + 1;
    };
    
    blob_ids
}

/// Get encrypted answer blob for a specific respondent
public fun get_answer_blob(survey: &Survey, respondent: address): &EncryptedAnswerBlob {
    table::borrow(&survey.encrypted_answer_blobs, respondent)
}

/// Check if user has answered survey
public fun has_answered(survey: &Survey, user: address): bool {
    table::contains(&survey.respondents, user)
}

/// Check if address is in allowlist
public fun is_in_allowlist(survey: &Survey, account: address): bool {
    vec_set::contains(&survey.allowlist, &account)
}

/// Get surveys by creator
public fun get_creator_surveys(registry: &SurveyRegistry, creator: address): vector<ID> {
    if (table::contains(&registry.surveys_by_creator, creator)) {
        *table::borrow(&registry.surveys_by_creator, creator)
    } else {
        vector::empty()
    }
}

/// Get surveys by category
public fun get_category_surveys(registry: &SurveyRegistry, category: String): vector<ID> {
    if (table::contains(&registry.surveys_by_category, category)) {
        *table::borrow(&registry.surveys_by_category, category)
    } else {
        vector::empty()
    }
}

/// Add questions to a survey (can only be done before any answers)
public fun add_questions(
    survey: &mut Survey,
    cap: &SurveyCap,
    questions: vector<Question>,
    clock: &Clock,
) {
    assert!(cap.survey_id == object::id(survey), EInvalidOwner);
    // Only allow adding questions if no one has answered yet
    assert!(survey.current_responses == 0, EAlreadyAnswered);
    
    // Add questions to the survey
    let mut i = 0;
    while (i < vector::length(&questions)) {
        let question = *vector::borrow(&questions, i);
        vector::push_back(&mut survey.questions, question);
        i = i + 1;
    };
    
    survey.updated_at = clock::timestamp_ms(clock);
}

// ======== Admin Functions ========

/// Withdraw platform fees (admin only)
public fun withdraw_fees(
    treasury: &mut PlatformTreasury,
    _cap: &AdminCap,
    amount: u64,
    recipient: address,
    ctx: &mut TxContext,
) {
    assert!(amount <= treasury.total_fees, EInsufficientPayment);
    
    if (df::exists_(&treasury.id, b"accumulated_fees")) {
        let mut coin = df::remove<vector<u8>, Coin<SUI>>(&mut treasury.id, b"accumulated_fees");
        
        if (coin::value(&coin) >= amount) {
            let payment = coin::split(&mut coin, amount, ctx);
            transfer::public_transfer(payment, recipient);
            
            if (coin::value(&coin) > 0) {
                df::add(&mut treasury.id, b"accumulated_fees", coin);
            } else {
                coin::destroy_zero(coin);
            };
            
            treasury.total_fees = treasury.total_fees - amount;
        } else {
            df::add(&mut treasury.id, b"accumulated_fees", coin);
        }
    }
}

/// Update platform fee rate (admin only)
public fun update_fee_rate(
    treasury: &mut PlatformTreasury,
    _cap: &AdminCap,
    new_rate: u64,
) {
    treasury.platform_fee_rate = new_rate;
}

// ======== Entry Functions ========

/// Enhanced entry function to create survey with questions
entry fun create_survey_with_questions_entry(
    title: vector<u8>,
    description: vector<u8>,
    category: vector<u8>,
    question_texts: vector<vector<u8>>,
    question_types: vector<u8>,
    question_options: vector<vector<vector<u8>>>,
    reward_per_response: u64,
    max_responses: u64,
    payment: Coin<SUI>,
    registry: &mut SurveyRegistry,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    // Build questions
    let mut questions = vector::empty<Question>();
    let mut i = 0;
    
    while (i < vector::length(&question_texts)) {
        let text = utf8(*vector::borrow(&question_texts, i));
        let q_type = *vector::borrow(&question_types, i);
        
        // Convert options for this question
        let options_raw = if (i < vector::length(&question_options)) {
            vector::borrow(&question_options, i)
        } else {
            &vector::empty<vector<u8>>()
        };
        
        let mut options = vector::empty<String>();
        let mut j = 0;
        while (j < vector::length(options_raw)) {
            let option = utf8(*vector::borrow(options_raw, j));
            vector::push_back(&mut options, option);
            j = j + 1;
        };
        
        let question = Question {
            question_text: text,
            question_type: q_type,
            options,
        };
        
        vector::push_back(&mut questions, question);
        i = i + 1;
    };
    
    let cap = create_survey(
        utf8(title),
        utf8(description),
        utf8(category),
        questions,
        reward_per_response,
        max_responses,
        payment,
        registry,
        clock,
        ctx
    );
    
    transfer::transfer(cap, ctx.sender());
}


/// Entry function to add questions
entry fun add_questions_entry(
    survey: &mut Survey,
    cap: &SurveyCap,
    question_texts: vector<vector<u8>>,
    question_types: vector<u8>,
    question_options: vector<vector<vector<u8>>>, // Nested vector for options
    clock: &Clock,
) {
    let mut questions = vector::empty<Question>();
    let mut i = 0;
    
    while (i < vector::length(&question_texts)) {
        let text = utf8(*vector::borrow(&question_texts, i));
        let q_type = *vector::borrow(&question_types, i);
        
        // Convert options
        let options_raw = vector::borrow(&question_options, i);
        let mut options = vector::empty<String>();
        let mut j = 0;
        while (j < vector::length(options_raw)) {
            let option = utf8(*vector::borrow(options_raw, j));
            vector::push_back(&mut options, option);
            j = j + 1;
        };
        
        let question = Question {
            question_text: text,
            question_type: q_type,
            options,
        };
        
        vector::push_back(&mut questions, question);
        i = i + 1;
    };
    
    add_questions(survey, cap, questions, clock);
}

/// Entry function to submit answer with blob ID
entry fun submit_answer_entry(
    survey: &mut Survey,
    blob_id: vector<u8>,
    seal_key_id: vector<u8>,
    consent_for_subscription: bool,
    treasury: &mut PlatformTreasury,
    registry: &mut SurveyRegistry,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    submit_answer(
        survey,
        utf8(blob_id),
        utf8(seal_key_id),
        consent_for_subscription,
        treasury,
        registry,
        clock,
        ctx
    );
}

/// Entry function to create subscription service
entry fun create_subscription_service_entry(
    survey: &Survey,
    cap: &SurveyCap,
    price: u64,
    duration_ms: u64,
    ctx: &mut TxContext,
) {
    create_subscription_service(survey, cap, price, duration_ms, ctx);
}

/// Entry function to purchase subscription
entry fun purchase_subscription_entry(
    service: &mut SubscriptionService,
    survey: &Survey,
    payment: Coin<SUI>,
    treasury: &mut PlatformTreasury,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    let subscription = purchase_subscription(
        service,
        survey,
        payment,
        treasury,
        clock,
        ctx
    );
    transfer::transfer(subscription, ctx.sender());
}