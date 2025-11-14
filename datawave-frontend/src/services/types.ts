// services/types.ts
// DataWave Platform Type Definitions - Complete Version

// ============================================
// Existing Types 
// ============================================

// Survey related types
export interface Survey {
  id: string;
  creator: string;
  title: string;
  description: string;
  category: string;
  questions: Question[];
  rewardPerResponse: number;
  maxResponses: number;
  currentResponses: number;
  createdAt: number;
  updatedAt: number;
  isActive: boolean;
  allowlist: string[];
  consentingUsersCount: number;
}

export interface Question {
  questionText: string;
  questionType: QuestionType;
  options: string[];
}

export enum QuestionType {
  SINGLE_CHOICE = 0,
  MULTIPLE_CHOICE = 1,
  TEXT = 2
}

export interface SurveyBasicInfo {
  creator: string;
  title: string;
  description: string;
  category: string;
  createdAt: number;
  isActive: boolean;
  currentResponses: number;
  maxResponses: number;
  rewardPerResponse: number;
}

export interface SurveyCap {
  id: string;
  surveyId: string;
}

// Answer related types
export interface EncryptedAnswerBlob {
  respondent: string;
  blobId: string;
  sealKeyId: string;
  submittedAt: number;
  consentForSubscription: boolean;
}

export interface SurveyAnswer {
  surveyId: string;
  answers: Array<{
    questionIndex: number;
    answer: string | string[]; // string for text/single choice, string[] for multiple choice
  }>;
}

// Subscription related types
export interface SubscriptionService {
  id: string;
  surveyId: string;
  price: number;
  durationMs: number;
  creator: string;
  totalRevenue: number;
}

export interface Subscription {
  id: string;
  serviceId: string;
  surveyId: string;
  subscriber: string;
  createdAt: number;
  expiresAt: number;
}

// Registry related types
export interface SurveyRegistry {
  totalSurveys: number;
  totalResponses: number;
  totalRewardsDistributed: number;
}

// Treasury related types
export interface PlatformTreasury {
  totalFees: number;
  platformFeeRate: number;
}

// Event types
export interface SurveyCreatedEvent {
  surveyId: string;
  creator: string;
  title: string;
  rewardPerResponse: number;
}

export interface SurveyAnsweredEvent {
  surveyId: string;
  respondent: string;
  blobId: string;
  rewardPaid: number;
  consentGiven: boolean;
}

export interface SubscriptionPurchasedEvent {
  surveyId: string;
  subscriber: string;
  price: number;
  expiresAt: number;
}

// Walrus Service types (reused from existing code)
export interface WalrusService {
  id: string;
  name: string;
  publisherUrl: string;
  aggregatorUrl: string;
}

export interface UploadedBlobInfo {
  status: string;
  blobId: string;
  endEpoch: string;
  blobUrl: string;
  suiUrl: string;
}

// ============================================
// New Types for Move Struct Handling
// ============================================

// Move
export interface MoveStruct {
  fields: Record<string, any>;
}

export interface MoveValue {
  type: string;
  fields?: Record<string, any>;
}

// Survey Move
export interface SurveyMoveFields {
  title: string;
  description: string;
  category: string;
  creator: string;
  created_at: string;
  is_active: boolean;
  reward_per_response: string;
  max_responses: string;
  current_responses: string;
  questions: any[];
  respondents?: {
    fields?: {
      id?: {
        id: string;
      }
    }
  };
  allowlist?: {
    fields?: {
      contents: string[];
    }
  } | string[];
  encrypted_answer_blobs?: {
    fields?: {
      id?: {
        id: string;
      }
    }
  };
  subscription_service_id?: string;
}

// Registry Move
export interface RegistryMoveFields {
  all_surveys?: {
    fields?: {
      id?: {
        id: string;
      }
    }
  };
  surveys_by_creator?: {
    fields?: {
      id?: {
        id: string;
      }
    }
  };
}

// Event
export interface EventDataFields {
  survey_id?: string;
  subscriber?: string;
  expires_at?: string;
  reward_amount?: string;
  reward_paid?: number;
  respondent?: string;
  blob_id?: string;
  consent_given?: boolean;
}

// Creator
export interface CreatorFieldData {
  value?: string[];
}

// SessionKey
export interface ExportedSessionKey {
  address: string;
  packageId: string;
  creationTimeMs: number;
  ttlMin: number;
  sessionKey: string;
}

// ============================================
// Type Guards and Helper Functions
// ============================================

// 类型守卫函数
export function isMoveStruct(obj: any): obj is MoveStruct {
  return obj && typeof obj === 'object' && 'fields' in obj;
}

export function isSurveyMoveFields(fields: any): fields is SurveyMoveFields {
  return fields && typeof fields === 'object' && 'title' in fields;
}

export function isRegistryMoveFields(fields: any): fields is RegistryMoveFields {
  return fields && typeof fields === 'object';
}

// 安全获取Move字段的辅助函数
export function getMoveField<T>(obj: any, fieldName: string, defaultValue: T): T {
  if (!obj || typeof obj !== 'object') {
    return defaultValue;
  }
  
  // 处理MoveStruct类型
  if ('fields' in obj && obj.fields && typeof obj.fields === 'object') {
    return obj.fields[fieldName] ?? defaultValue;
  }
  
  // 直接访问
  return obj[fieldName] ?? defaultValue;
}

// 安全获取嵌套字段
export function getNestedField<T>(obj: any, path: string, defaultValue: T): T {
  const keys = path.split('.');
  let current = obj;
  
  for (const key of keys) {
    if (!current || typeof current !== 'object') {
      return defaultValue;
    }
    current = current[key];
  }
  
  return current ?? defaultValue;
}

// 安全解析Move字段
export function parseMoveFields(obj: any): SurveyMoveFields | null {
  if (!isMoveStruct(obj)) return null;
  
  const fields = obj.fields;
  if (!isSurveyMoveFields(fields)) return null;
  
  return fields;
}

// 安全解析Registry字段
export function parseRegistryFields(obj: any): RegistryMoveFields | null {
  if (!isMoveStruct(obj)) return null;
  
  const fields = obj.fields;
  if (!isRegistryMoveFields(fields)) return null;
  
  return fields;
}

// 解析事件数据
export function parseEventData(event: any): EventDataFields {
  if (!event) return {};
  
  // 优先使用parsedJson
  if (event.parsedJson && typeof event.parsedJson === 'object') {
    return event.parsedJson as EventDataFields;
  }
  
  // 备选：使用data字段
  if (event.data && typeof event.data === 'object') {
    return event.data as EventDataFields;
  }
  
  return {};
}

// 创建兼容的SessionKey对象
export function createSessionKey(stored: any): ExportedSessionKey {
  return {
    address: stored?.address || '',
    packageId: stored?.packageId || '',
    creationTimeMs: stored?.creationTimeMs || Date.now(),
    ttlMin: stored?.ttlMin || 60,
    sessionKey: stored?.sessionKey || ''
  };
}

// Transaction包装器（处理版本兼容性）
export function wrapTransaction(tx: any): any {
  return tx;
}

// SuiClient包装器（处理版本兼容性）
export function wrapSuiClient(client: any): any {
  return client;
}

// 安全的类型断言
export function assertType<T>(value: any): T {
  return value as T;
}

// 安全执行可选值操作
export function withOptional<T, R>(
  value: T | undefined | null,
  fn: (val: T) => R
): R | undefined {
  if (value !== undefined && value !== null) {
    return fn(value);
  }
  return undefined;
}

// ============================================
// Component-specific Types
// ============================================

// MySurveys组件使用的Survey数据
export interface MySurveyData {
  id: string;
  capId?: string;
  title: string;
  description: string;
  category: string;
  rewardPerResponse: string;
  maxResponses: string;
  currentResponses: string;
  isActive: boolean;
  createdAt: string;
  creator: string;
  questions: any[];
  subscriptionServiceId?: string;
  hasSubscription?: boolean;
  subscriptionService?: {
    serviceId: string;
    price: number;
    duration: number;
    totalRevenue: number;
    subscriberCount: number;
  };
}

// MyAllowlistAccess组件使用的数据
export interface AllowlistSurveyData {
  id: string;
  title: string;
  description: string;
  category: string;
  creator: string;
  createdAt: string;
  isActive: boolean;
  currentResponses: number;
  maxResponses: number;
  questions: any[];
  allowlistSize: number;
  addedToAllowlistAt?: string;
  canDecrypt: boolean;
  hasAnswers: boolean;
  answerCount: number;
}

// Subscription组件使用的数据
export interface UserSubscriptionData {
  subscriptionId: string;
  serviceId: string;
  surveyId: string;
  surveyTitle: string;
  surveyDescription: string;
  surveyCategory: string;
  createdAt: number;
  expiresAt: number;
  isExpired: boolean;
  responseCount: number;
  maxResponses: number;
  price: number;
  duration: number;
}

// ============================================
// API Response Types
// ============================================

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

// ============================================
// Form Types
// ============================================

export interface CreateSurveyForm {
  title: string;
  description: string;
  category: string;
  questions: Question[];
  rewardPerResponse: number;
  maxResponses: number;
  allowlist?: string[];
  enableSubscription?: boolean;
  subscriptionPrice?: number;
  subscriptionDuration?: number;
}

export interface AnswerSurveyForm {
  surveyId: string;
  answers: Array<{
    questionIndex: number;
    answer: string | string[];
  }>;
  consentForSubscription: boolean;
}

// ============================================
// UI State Types
// ============================================

export interface LoadingState {
  isLoading: boolean;
  message?: string;
}

export interface ErrorState {
  hasError: boolean;
  message?: string;
  code?: string;
}

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
  duration?: number;
}

// ============================================
// Export all types
// ============================================

export * from './config';  // 假设还有config类型定义