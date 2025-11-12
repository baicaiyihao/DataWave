// DataWave Platform Type Definitions

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