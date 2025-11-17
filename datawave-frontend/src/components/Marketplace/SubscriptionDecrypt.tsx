// src/components/Marketplace/SubscriptionDecrypt.tsx
import { useState, useEffect } from 'react';
import { useSuiClient, useCurrentAccount, useSignPersonalMessage } from '@mysten/dapp-kit';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { Transaction } from '@mysten/sui/transactions';
import { fromHex } from '@mysten/sui/utils';
import { SealClient, SessionKey, EncryptedObject, NoAccessError } from '@mysten/seal';
import { ConfigService } from '../../services/config';
import { 
  Lock,
  Unlock,
  Download,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  Users,
  Clock,
  Key,
  Eye,
  ArrowLeft,
  ShoppingCart,
  Shield
} from 'lucide-react';
import { set, get } from 'idb-keyval';
import './SubscriptionDecrypt.css';

const TTL_MIN = 10;

interface AnswerBlob {
  respondent: string;
  blobId: string;
  sealKeyId: string;
  submittedAt: number;
  consentForSubscription: boolean;
}

interface DecryptedAnswer {
  surveyId: string;
  respondent: string;
  timestamp: number;
  answers: {
    questionIndex: number;
    questionText: string;
    questionType: number;
    answer: string | string[];
  }[];
  consent: boolean;
}

interface SurveyInfo {
  id: string;
  title: string;
  description: string;
  category: string;
  questions: any[];
  responseCount: number;
  maxResponses: number;
  consentingUsers: number;
}

interface SubscriptionInfo {
  id: string;
  serviceId: string;
  surveyId: string;
  expiresAt: number;
  isExpired: boolean;
  createdAt: number;
}

interface ToastData {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
}

export function SubscriptionDecrypt() {
  const { surveyId } = useParams<{ surveyId: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const suiClient = useSuiClient();
  const currentAccount = useCurrentAccount();
  const { mutate: signPersonalMessage } = useSignPersonalMessage();
  const packageId = ConfigService.getPackageId();
  
  // Get subscriptionId and return path from route state
  const subscriptionId = location.state?.subscriptionId;
  const returnPath = location.state?.returnPath;
  
  // Survey and subscription data
  const [surveyInfo, setSurveyInfo] = useState<SurveyInfo | null>(null);
  const [subscriptionInfo, setSubscriptionInfo] = useState<SubscriptionInfo | null>(null);
  const [answerBlobs, setAnswerBlobs] = useState<AnswerBlob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Session key
  const [sessionKey, setSessionKey] = useState<SessionKey | null>(null);
  const [creatingSession, setCreatingSession] = useState(false);
  
  // Decryption state
  const [decryptingBlobId, setDecryptingBlobId] = useState<string | null>(null);
  const [decryptedAnswers, setDecryptedAnswers] = useState<Map<string, DecryptedAnswer>>(new Map());
  const [showDecryptedDialog, setShowDecryptedDialog] = useState(false);
  const [currentDecryptedAnswer, setCurrentDecryptedAnswer] = useState<DecryptedAnswer | null>(null);
  
  // Download progress state
  const [downloadProgress, setDownloadProgress] = useState<{
    current: number;
    total: number;
    status: string;
  } | null>(null);

  // Modal states
  const [showResultModal, setShowResultModal] = useState(false);
  const [resultModalData, setResultModalData] = useState<{
    type: 'success' | 'warning' | 'error';
    title: string;
    stats?: {
      total: number;
      success: number;
      failed: number;
      notDownloaded: number;
    };
    message?: string;
  } | null>(null);

  // Toast notifications
  const [toasts, setToasts] = useState<ToastData[]>([]);

  const showToast = (type: ToastData['type'], message: string) => {
    const id = Date.now().toString();
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(toast => toast.id !== id));
    }, 3000);
  };

  // Navigation functions
  const goBack = () => {
    if (returnPath) {
      navigate(returnPath);
    } else if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate('/app/marketplace/subscriptions');
    }
  };

  const browseSubscriptions = () => {
    navigate('/app/marketplace/subscriptions');
  };
  
  // Seal client configuration
  const serverObjectIds = [
    "0x73d05d62c18d9374e3ea529e8e0ed6161da1a141a94d3f76ae3fe4e99356db75",
    "0xf5d14a81a982144ae441cd7d64b09027f116a468bd36e7eca494f750591623c8"
  ];
  
  const sealClient = new SealClient({
    suiClient,
    serverConfigs: serverObjectIds.map((id) => ({
      objectId: id,
      weight: 1,
    })),
    verifyKeyServers: false,
  });

  // Move call constructor for subscription access
  const moveCallConstructor = (tx: Transaction, id: string) => {
    if (!subscriptionInfo || !surveyId) {
      throw new Error('No subscription info available');
    }
    
    tx.moveCall({
      target: `${packageId}::survey_system::seal_approve_subscription`,
      arguments: [
        tx.pure.vector('u8', fromHex(id)),
        tx.object(subscriptionInfo.id),
        tx.object(subscriptionInfo.serviceId),
        tx.object(surveyId),
        tx.object('0x6'),
      ],
    });
  };

  // Load survey and subscription data
  const loadData = async () => {
    if (!currentAccount?.address || !surveyId) return;
    
    setLoading(true);
    setError(null);
    
    try {
      // Load survey details
      const surveyObj = await suiClient.getObject({
        id: surveyId,
        options: { showContent: true }
      });
      
      if (surveyObj.data?.content && 'fields' in surveyObj.data.content) {
        const fields = surveyObj.data.content.fields as any;
        
        const questions = fields.questions?.map((q: any) => ({
          question_text: q.fields?.question_text || q.question_text || '',
          question_type: parseInt(q.fields?.question_type || q.question_type || '0'),
          options: q.fields?.options || q.options || []
        })) || [];
        
        setSurveyInfo({
          id: surveyId,
          title: fields.title || '',
          description: fields.description || '',
          category: fields.category || '',
          questions,
          responseCount: parseInt(fields.current_responses || '0'),
          maxResponses: parseInt(fields.max_responses || '0'),
          consentingUsers: parseInt(fields.consenting_users_count || '0'),
        });
        
        // Load answer blobs
        await loadConsentedAnswerBlobs(fields);
      }
      
      // Load subscription info
      if (subscriptionId) {
        const subObj = await suiClient.getObject({
          id: subscriptionId,
          options: { showContent: true }
        });
        
        if (subObj.data?.content && 'fields' in subObj.data.content) {
          const fields = subObj.data.content.fields as any;
          const now = Date.now();
          const expiresAt = parseInt(fields.expires_at);
          
          setSubscriptionInfo({
            id: subscriptionId,
            serviceId: fields.service_id,
            surveyId: fields.survey_id,
            expiresAt,
            isExpired: expiresAt < now,
            createdAt: parseInt(fields.created_at),
          });
        }
      } else {
        // Find user's subscription
        const userSubscriptions = await suiClient.getOwnedObjects({
          owner: currentAccount.address,
          options: { showContent: true },
          filter: {
            StructType: `${packageId}::survey_system::Subscription`,
          },
        });
        
        for (const sub of userSubscriptions.data) {
          if (sub.data?.content && 'fields' in sub.data.content) {
            const fields = sub.data.content.fields as any;
            if (fields.survey_id === surveyId) {
              const now = Date.now();
              const expiresAt = parseInt(fields.expires_at);
              
              setSubscriptionInfo({
                id: sub.data.objectId,
                serviceId: fields.service_id,
                surveyId: fields.survey_id,
                expiresAt,
                isExpired: expiresAt < now,
                createdAt: parseInt(fields.created_at),
              });
              break;
            }
          }
        }
      }
    } catch (err: any) {
      console.error('Error loading data:', err);
      setError(err.message || 'Failed to load survey data');
    } finally {
      setLoading(false);
    }
  };

  // Load only consented answer blobs
  const loadConsentedAnswerBlobs = async (surveyFields: any) => {
    const blobs: AnswerBlob[] = [];
    
    if (surveyFields.encrypted_answer_blobs?.fields?.id?.id) {
      try {
        const answersTableFields = await suiClient.getDynamicFields({
          parentId: surveyFields.encrypted_answer_blobs.fields.id.id,
        });
        
        for (const field of answersTableFields.data) {
          const fieldData = await suiClient.getObject({
            id: field.objectId,
            options: { showContent: true }
          });
          
          if (fieldData.data?.content && 'fields' in fieldData.data.content) {
            const value = (fieldData.data.content as any).fields?.value?.fields;
            if (value && value.consent_for_subscription) {
              let sealKeyIdStr = value.seal_key_id;
              
              if (Array.isArray(sealKeyIdStr)) {
                sealKeyIdStr = new TextDecoder().decode(new Uint8Array(sealKeyIdStr));
              }
              
              blobs.push({
                respondent: value.respondent,
                blobId: value.blob_id,
                sealKeyId: sealKeyIdStr,
                submittedAt: parseInt(value.submitted_at),
                consentForSubscription: value.consent_for_subscription
              });
            }
          }
        }
      } catch (error) {
        console.error('Error loading answer blobs:', error);
      }
    }
    
    setAnswerBlobs(blobs);
  };

  // Create or load session key
  const handleSessionKey = async () => {
    if (!currentAccount?.address || !signPersonalMessage) {
      setError('Please connect wallet first');
      return;
    }
    
    setCreatingSession(true);
    setError(null);
    
    try {
      const stored = await get('sessionKey_subscription');
      if (stored) {
        try {
          const imported = await SessionKey.import(stored as any, suiClient);
          if (!imported.isExpired() && imported.getAddress() === currentAccount.address) {
            setSessionKey(imported);
            setCreatingSession(false);
            showToast('success', 'Session key loaded successfully');
            return;
          }
        } catch (e) {
          console.log('Stored session key expired or invalid');
        }
      }
      
      const newSessionKey = await SessionKey.create({
        address: currentAccount.address,
        packageId: packageId,
        ttlMin: TTL_MIN,
        suiClient,
      });
      
      signPersonalMessage(
        {
          message: newSessionKey.getPersonalMessage(),
        },
        {
          onSuccess: async (result) => {
            await newSessionKey.setPersonalMessageSignature(result.signature);
            setSessionKey(newSessionKey);
            await set('sessionKey_subscription', newSessionKey.export());
            setCreatingSession(false);
            showToast('success', 'Session key created successfully');
          },
          onError: (error) => {
            console.error('Signature failed:', error);
            setError('Failed to sign message');
            setCreatingSession(false);
            showToast('error', 'Failed to create session key');
          }
        }
      );
    } catch (error: any) {
      console.error('Session key error:', error);
      setError(error.message);
      setCreatingSession(false);
      showToast('error', 'Session key error: ' + error.message);
    }
  };

  // Download and decrypt blobs
  const downloadAndDecrypt = async (blobIds: string[]) => {
    if (!sessionKey || !subscriptionInfo) return;
    
    if (subscriptionInfo.isExpired) {
      throw new Error('Subscription has expired');
    }
    
    const aggregators = [
      'aggregator1',
      'aggregator2',
      'aggregator3',
      'aggregator4',
      'aggregator5',
      'aggregator6',
    ];
    
    // Download single blob with retry
    const downloadBlobWithRetry = async (blobId: string, maxRetries = 3): Promise<{ blobId: string; data: ArrayBuffer } | null> => {
      const attemptedAggregators = new Set<string>();
      
      for (let attempt = 0; attempt < maxRetries; attempt++) {
        const availableAggregators = aggregators.filter(a => !attemptedAggregators.has(a));
        
        if (availableAggregators.length === 0) {
          console.error(`All aggregators failed for blob ${blobId}`);
          break;
        }
        
        const randomIndex = Math.floor(Math.random() * availableAggregators.length);
        const aggregator = availableAggregators[randomIndex];
        attemptedAggregators.add(aggregator);
        
        try {
          console.log(`Attempting download from ${aggregator} for blob ${blobId.slice(0, 10)}...`);
          
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 10000);
          
          const aggregatorUrl = `/${aggregator}/v1/blobs/${blobId}`;
          const response = await fetch(aggregatorUrl, { 
            signal: controller.signal,
            headers: {
              'Cache-Control': 'no-cache',
              'Pragma': 'no-cache'
            }
          });
          
          clearTimeout(timeout);
          
          if (response.ok) {
            const data = await response.arrayBuffer();
            console.log(`Successfully downloaded blob ${blobId.slice(0, 10)}... from ${aggregator}`);
            return { blobId, data };
          } else {
            console.warn(`Failed to download from ${aggregator}: HTTP ${response.status}`);
          }
        } catch (err) {
          console.error(`Error downloading from ${aggregator}:`, err);
        }
      }
      
      return null;
    };
    
    // Parallel download all files
    console.log(`Starting download of ${blobIds.length} blobs...`);
    
    setDownloadProgress({
      current: 0,
      total: blobIds.length,
      status: 'Downloading files...'
    });
    
    let downloadedCount = 0;
    const downloadResults = await Promise.all(
      blobIds.map(async (blobId) => {
        const result = await downloadBlobWithRetry(blobId);
        downloadedCount++;
        setDownloadProgress({
          current: downloadedCount,
          total: blobIds.length,
          status: `Downloaded ${downloadedCount}/${blobIds.length} files...`
        });
        return result;
      })
    );

    const validDownloads = downloadResults.filter((result): result is { blobId: string; data: ArrayBuffer } => result !== null);
    
    console.log(`Successfully downloaded ${validDownloads.length}/${blobIds.length} blobs`);
    
    if (validDownloads.length === 0) {
      throw new Error('Failed to download any files. All aggregator nodes might be unavailable.');
    }

    // Fetch keys in batches
    console.log('Fetching decryption keys...');
    setDownloadProgress({
      current: downloadedCount,
      total: blobIds.length,
      status: 'Fetching decryption keys...'
    });

    for (let i = 0; i < validDownloads.length; i += 10) {
      const batch = validDownloads.slice(i, i + 10);
      const ids = batch.map((item) => EncryptedObject.parse(new Uint8Array(item.data)).id);
      const tx = new Transaction();
      ids.forEach((id) => moveCallConstructor(tx, id));
      const txBytes = await tx.build({ client: suiClient as any, onlyTransactionKind: true });
      
      try {
        await sealClient.fetchKeys({ ids, txBytes, sessionKey, threshold: 2 });
        console.log(`Fetched keys for batch ${Math.floor(i/10) + 1}`);
      } catch (err) {
        console.error('Error fetching keys:', err);
        const errorMsg = err instanceof NoAccessError
          ? 'No subscription access'
          : 'Failed to decrypt files';
        throw new Error(errorMsg);
      }
    }

    // Decrypt files
    console.log('Decrypting files...');
    setDownloadProgress({
      current: downloadedCount,
      total: blobIds.length,
      status: 'Decrypting answers...'
    });

    const decryptedData: DecryptedAnswer[] = [];
    const failedDecryptions: string[] = [];
    
    for (const { blobId, data } of validDownloads) {
      try {
        const fullId = EncryptedObject.parse(new Uint8Array(data)).id;
        const tx = new Transaction();
        moveCallConstructor(tx, fullId);
        const txBytes = await tx.build({ client: suiClient as any, onlyTransactionKind: true });
        
        const decryptedFile = await sealClient.decrypt({
          data: new Uint8Array(data),
          sessionKey,
          txBytes,
        });
        
        const answerJson = new TextDecoder().decode(decryptedFile);
        const answerData = JSON.parse(answerJson);
        
        const blob = answerBlobs.find(b => b.blobId === blobId);
        if (blob) {
          const decryptedAnswer = {
            surveyId: answerData.surveyId,
            respondent: blob.respondent,
            timestamp: answerData.timestamp || blob.submittedAt,
            answers: answerData.answers,
            consent: answerData.consent || blob.consentForSubscription
          };
          
          decryptedData.push(decryptedAnswer);
          decryptedAnswers.set(blobId, decryptedAnswer);
          console.log(`Successfully decrypted blob ${blobId.slice(0, 10)}...`);
        }
      } catch (err) {
        console.error(`Failed to decrypt blob ${blobId.slice(0, 10)}...`, err);
        failedDecryptions.push(blobId);
      }
    }

    setDownloadProgress(null);

    if (decryptedData.length > 0) {
      setDecryptedAnswers(new Map(decryptedAnswers));
      
      // Show result modal
      setResultModalData({
        type: validDownloads.length === blobIds.length && failedDecryptions.length === 0 ? 'success' : 'warning',
        title: 'Decryption Complete',
        stats: {
          total: blobIds.length,
          success: decryptedData.length,
          failed: failedDecryptions.length,
          notDownloaded: blobIds.length - validDownloads.length
        }
      });
      setShowResultModal(true);
    } else {
      setResultModalData({
        type: 'error',
        title: 'Decryption Failed',
        message: 'Unable to decrypt any answers. Please check your subscription status and try again.'
      });
      setShowResultModal(true);
    }
  };

  // Decrypt single answer
  const decryptSingleAnswer = async (blob: AnswerBlob) => {
    if (!sessionKey || !subscriptionInfo) {
      setError('Please create session key first');
      return;
    }
    
    if (subscriptionInfo.isExpired) {
      setError('Your subscription has expired');
      return;
    }
    
    setDecryptingBlobId(blob.blobId);
    setError(null);
    
    try {
      await downloadAndDecrypt([blob.blobId]);
      const decrypted = decryptedAnswers.get(blob.blobId);
      if (decrypted) {
        setCurrentDecryptedAnswer(decrypted);
        setShowDecryptedDialog(true);
      }
    } catch (error: any) {
      console.error('Decryption error:', error);
      setError(error.message || 'Decryption failed');
      showToast('error', 'Failed to decrypt: ' + error.message);
    } finally {
      setDecryptingBlobId(null);
    }
  };

  // Decrypt all answers
  const decryptAllAnswers = async () => {
    if (!sessionKey || !subscriptionInfo) {
      setError('Please create session key first');
      return;
    }
    
    if (subscriptionInfo.isExpired) {
      setError('Your subscription has expired');
      return;
    }

    setError(null);
    setDecryptingBlobId('all');
    
    try {
      const blobIds = answerBlobs.map(b => b.blobId);
      await downloadAndDecrypt(blobIds);
    } catch (error: any) {
      console.error('Batch decryption error:', error);
      setError(error.message || 'Batch decryption failed');
      showToast('error', 'Batch decryption failed: ' + error.message);
    } finally {
      setDecryptingBlobId(null);
    }
  };

  // Export to CSV
  const exportToCSV = () => {
    if (!decryptedAnswers.size || !surveyInfo) return;
    
    const answers = Array.from(decryptedAnswers.values());
    
    const headers = ['Respondent', 'Submitted At', 'Consent'];
    surveyInfo.questions.forEach(q => {
      headers.push(q.question_text);
    });
    
    const rows = answers.map(answer => {
      const row = [
        answer.respondent,
        new Date(answer.timestamp).toLocaleString(),
        answer.consent ? 'Yes' : 'No'
      ];
      
      answer.answers.forEach(a => {
        const value = Array.isArray(a.answer) ? a.answer.join(', ') : a.answer;
        row.push(value);
      });
      
      return row;
    });
    
    const csvContent = [
      headers.join(','),
      ...rows.map(r => r.map(cell => `"${cell}"`).join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `survey-${surveyId}-subscription-answers.csv`;
    link.click();
    window.URL.revokeObjectURL(url);
    
    showToast('success', 'CSV exported successfully');
  };

  // Load data on mount
  useEffect(() => {
    if (surveyId) {
      loadData();
    }
  }, [surveyId, subscriptionId, currentAccount?.address]);

  // Auto load session key
  useEffect(() => {
    if (!currentAccount?.address || sessionKey) return;
    
    const loadExisting = async () => {
      try {
        const stored = await get('sessionKey_subscription');
        if (stored) {
          const imported = await SessionKey.import(stored as any, suiClient);
          if (!imported.isExpired() && imported.getAddress() === currentAccount.address) {
            setSessionKey(imported);
          }
        }
      } catch (e) {
        console.log('No valid stored session key');
      }
    };
    
    loadExisting();
  }, [currentAccount?.address]);

  // Format functions
  const formatDate = (timestamp: number): string => {
    return new Date(timestamp).toLocaleString();
  };

  const getTimeRemaining = (expiresAt: number): string => {
    const now = Date.now();
    const diff = expiresAt - now;
    
    if (diff <= 0) return 'Expired';
    
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    
    if (days > 0) return `${days} days ${hours} hours remaining`;
    return `${hours} hours remaining`;
  };

  const formatAnswer = (answer: any, questionType: number) => {
    if (questionType === 0) return answer;
    if (questionType === 1) return Array.isArray(answer) ? answer.join(', ') : answer;
    return answer;
  };

  // Render different states
  if (!surveyId) {
    return (
      <div className="sd-container">
        <div className="sd-no-access">
          <AlertCircle size={48} className="sd-no-access-icon" />
          <h2 className="sd-no-access-title">No Survey ID</h2>
          <p className="sd-no-access-desc">Survey ID is required to view this page</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="sd-container">
        <div className="sd-loading">
          <div className="sd-loading-spinner"></div>
          <div className="sd-loading-text">Loading survey data...</div>
        </div>
      </div>
    );
  }

  if (!surveyInfo) {
    return (
      <div className="sd-container">
        <div className="sd-no-access">
          <AlertCircle size={48} className="sd-no-access-icon" />
          <h2 className="sd-no-access-title">Survey Not Found</h2>
          <p className="sd-no-access-desc">The requested survey could not be found</p>
          <button className="sd-btn primary" onClick={goBack}>
            <ArrowLeft size={16} />
            Go Back
          </button>
        </div>
      </div>
    );
  }

  if (!subscriptionInfo) {
    return (
      <div className="sd-container">
        <div className="sd-no-access">
          <Lock size={48} className="sd-no-access-icon" />
          <h2 className="sd-no-access-title">Subscription Required</h2>
          <p className="sd-no-access-desc">You need an active subscription to view survey answers</p>
          <button className="sd-btn primary" onClick={browseSubscriptions}>
            <ShoppingCart size={16} />
            Browse Subscriptions
          </button>
        </div>
      </div>
    );
  }

  // Main UI
  return (
    <div className="sd-container">
      {/* Header */}
      <div className="sd-header">
        <button className="sd-back-btn" onClick={goBack}>
          <ArrowLeft size={16} />
          Back
        </button>
        
        <div className="sd-header-content">
          <div className="sd-survey-info">
            <h1 className="sd-survey-title">{surveyInfo.title}</h1>
            <p className="sd-survey-desc">{surveyInfo.description}</p>
            <div className="sd-survey-stats">
              <span className="sd-stat-badge category">{surveyInfo.category}</span>
              <span className="sd-stat-badge responses">
                <Users size={14} />
                {surveyInfo.responseCount} Responses
              </span>
              <span className="sd-stat-badge consented">
                <CheckCircle size={14} />
                {surveyInfo.consentingUsers} Consented
              </span>
            </div>
          </div>
          
          <div className="sd-subscription-status">
            {subscriptionInfo.isExpired ? (
              <div className="sd-status-badge expired">
                <AlertCircle size={16} />
                Subscription Expired
              </div>
            ) : (
              <div className="sd-status-badge active">
                <Clock size={16} />
                {getTimeRemaining(subscriptionInfo.expiresAt)}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Control Panel */}
      <div className="sd-control-panel">
        <div className="sd-control-header">
          <div>
            <h2 className="sd-control-title">Decryption Controls</h2>
            <p className="sd-control-subtitle">
              {answerBlobs.length} consented answers available for decryption
            </p>
          </div>
          
          <div className={`sd-session-badge ${sessionKey ? 'ready' : 'not-ready'}`}>
            <Key size={14} />
            {sessionKey ? 'Session Key Ready' : 'No Session Key'}
          </div>
        </div>
        
        <div className="sd-control-actions">
          {!sessionKey && (
            <button
              className="sd-btn primary"
              onClick={handleSessionKey}
              disabled={creatingSession}
            >
              {creatingSession ? (
                <>
                  <RefreshCw size={16} className="sd-spinning" />
                  Creating Session Key...
                </>
              ) : (
                <>
                  <Key size={16} />
                  Create Session Key
                </>
              )}
            </button>
          )}
          
          {sessionKey && !subscriptionInfo.isExpired && answerBlobs.length > 0 && (
            <>
              <button
                className="sd-btn success"
                onClick={decryptAllAnswers}
                disabled={decryptingBlobId === 'all'}
              >
                {decryptingBlobId === 'all' ? (
                  <>
                    <RefreshCw size={16} className="sd-spinning" />
                    Decrypting All...
                  </>
                ) : (
                  <>
                    <Unlock size={16} />
                    Decrypt All Answers
                  </>
                )}
              </button>
              
              {decryptedAnswers.size > 0 && (
                <button
                  className="sd-btn secondary"
                  onClick={exportToCSV}
                >
                  <Download size={16} />
                  Export to CSV
                </button>
              )}
            </>
          )}
        </div>
        
        {error && (
          <div className="sd-error-message">
            <AlertCircle size={16} />
            {error}
          </div>
        )}
        
        {/* Download Progress */}
        {downloadProgress && (
          <div className="sd-progress-container">
            <div className="sd-progress-header">
              <RefreshCw size={16} className="sd-spinning" />
              <span>{downloadProgress.status}</span>
            </div>
            <div className="sd-progress-bar">
              <div 
                className="sd-progress-fill"
                style={{ width: `${(downloadProgress.current / downloadProgress.total) * 100}%` }}
              />
            </div>
            <div className="sd-progress-text">
              {downloadProgress.current} of {downloadProgress.total} files processed
            </div>
          </div>
        )}
      </div>

      {/* Answers List */}
      <div className="sd-answers-section">
        <h2 className="sd-answers-header">
          Survey Answers
          <span className="sd-answers-count">{answerBlobs.length}</span>
        </h2>
        
        {answerBlobs.length === 0 ? (
          <div className="sd-empty-state">
            <Shield size={48} className="sd-empty-icon" />
            <h3 className="sd-empty-title">No Consented Answers</h3>
            <p className="sd-empty-desc">
              There are no answers with consent for subscription sharing
            </p>
          </div>
        ) : (
          <div>
            {answerBlobs.map((blob, idx) => {
              const isDecrypted = decryptedAnswers.has(blob.blobId);
              
              return (
                <div key={blob.blobId} className="sd-answer-card">
                  <div className="sd-answer-content">
                    <div className="sd-answer-info">
                      <div className="sd-answer-header">
                        <span className="sd-answer-number">Answer #{idx + 1}</span>
                        <div className="sd-answer-badges">
                          <span className="sd-answer-badge consented">Consented</span>
                          {isDecrypted && (
                            <span className="sd-answer-badge decrypted">Decrypted</span>
                          )}
                        </div>
                      </div>
                      <div className="sd-answer-meta">
                        Submitted: {formatDate(blob.submittedAt)}
                      </div>
                      <div className="sd-answer-blob">
                        Blob ID: {blob.blobId.slice(0, 20)}...
                      </div>
                    </div>
                    
                    <div className="sd-answer-actions">
                      {isDecrypted && (
                        <button
                          className="sd-btn secondary"
                          onClick={() => {
                            setCurrentDecryptedAnswer(decryptedAnswers.get(blob.blobId)!);
                            setShowDecryptedDialog(true);
                          }}
                        >
                          <Eye size={16} />
                          View
                        </button>
                      )}
                      <button
                        className="sd-btn primary"
                        onClick={() => decryptSingleAnswer(blob)}
                        disabled={!sessionKey || subscriptionInfo.isExpired || decryptingBlobId === blob.blobId}
                      >
                        {decryptingBlobId === blob.blobId ? (
                          <>
                            <RefreshCw size={16} className="sd-spinning" />
                            Decrypting...
                          </>
                        ) : isDecrypted ? (
                          <>
                            <Unlock size={16} />
                            Re-decrypt
                          </>
                        ) : (
                          <>
                            <Lock size={16} />
                            Decrypt
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Result Modal */}
      {showResultModal && resultModalData && (
        <div className="sd-modal-overlay" onClick={() => setShowResultModal(false)}>
          <div className="sd-result-modal" onClick={e => e.stopPropagation()}>
            <div className="sd-modal-icon" style={{ 
              color: resultModalData.type === 'success' ? '#10b981' : 
                     resultModalData.type === 'warning' ? '#f59e0b' : '#ef4444' 
            }}>
              {resultModalData.type === 'success' ? (
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                  <polyline points="22 4 12 14.01 9 11.01" />
                </svg>
              ) : resultModalData.type === 'warning' ? (
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              ) : (
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="15" y1="9" x2="9" y2="15" />
                  <line x1="9" y1="9" x2="15" y2="15" />
                </svg>
              )}
            </div>
            
            <h3 className="sd-modal-title">{resultModalData.title}</h3>
            
            {resultModalData.stats ? (
              <div className="sd-modal-stats">
                <div className="sd-stat-row">
                  <span className="sd-stat-label">Total Files:</span>
                  <span className="sd-stat-value">{resultModalData.stats.total}</span>
                </div>
                <div className="sd-stat-row success">
                  <span className="sd-stat-label">✓ Successfully Decrypted:</span>
                  <span className="sd-stat-value">{resultModalData.stats.success}</span>
                </div>
                {resultModalData.stats.failed > 0 && (
                  <div className="sd-stat-row warning">
                    <span className="sd-stat-label">⚠ Failed to Decrypt:</span>
                    <span className="sd-stat-value">{resultModalData.stats.failed}</span>
                  </div>
                )}
                {resultModalData.stats.notDownloaded > 0 && (
                  <div className="sd-stat-row error">
                    <span className="sd-stat-label">✕ Download Failed:</span>
                    <span className="sd-stat-value">{resultModalData.stats.notDownloaded}</span>
                  </div>
                )}
              </div>
            ) : (
              <p className="sd-modal-message">{resultModalData.message}</p>
            )}
            
            <div className="sd-modal-actions">
              {resultModalData.type === 'success' && decryptedAnswers.size > 0 && (
                <button 
                  className="sd-btn success"
                  onClick={() => {
                    exportToCSV();
                    setShowResultModal(false);
                  }}
                >
                  <Download size={16} />
                  Export CSV
                </button>
              )}
              <button 
                className="sd-btn secondary"
                onClick={() => setShowResultModal(false)}
              >
                Close
              </button>
            </div>
            
            {resultModalData.type === 'success' && (
              <div className="sd-modal-progress"></div>
            )}
          </div>
        </div>
      )}

      {/* Decrypted Answer Modal */}
      {showDecryptedDialog && currentDecryptedAnswer && (
        <div className="sd-modal-overlay" onClick={() => setShowDecryptedDialog(false)}>
          <div className="sd-answer-detail-modal" onClick={e => e.stopPropagation()}>
            <h3 className="sd-modal-header">Decrypted Answer Details</h3>
            
            <div className="sd-modal-metadata">
              <div className="sd-metadata-item">
                <strong>Respondent:</strong> {currentDecryptedAnswer.respondent.slice(0, 16)}...
              </div>
              <div className="sd-metadata-item">
                <strong>Submitted:</strong> {formatDate(currentDecryptedAnswer.timestamp)}
              </div>
            </div>
            
            <div className="sd-answer-questions">
              {currentDecryptedAnswer.answers.map((ans, idx) => (
                <div key={idx} className="sd-question-item">
                  <div className="sd-question-number">Question {ans.questionIndex + 1}</div>
                  <div className="sd-question-text">{ans.questionText}</div>
                  <div className="sd-question-answer">
                    {formatAnswer(ans.answer, ans.questionType)}
                  </div>
                </div>
              ))}
            </div>
            
            <button
              className="sd-btn secondary full-width"
              onClick={() => setShowDecryptedDialog(false)}
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Toast Notifications */}
      <div className="sd-toast-container">
        {toasts.map(toast => (
          <div key={toast.id} className={`sd-toast ${toast.type}`}>
            <div className="sd-toast-icon">
              {toast.type === 'success' && <CheckCircle size={16} />}
              {toast.type === 'error' && <AlertCircle size={16} />}
              {toast.type === 'warning' && <AlertCircle size={16} />}
              {toast.type === 'info' && <AlertCircle size={16} />}
            </div>
            <span className="sd-toast-message">{toast.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default SubscriptionDecrypt;