// src/components/Enterprise/SurveyDecryption.tsx
import { useState, useEffect } from 'react';
import { useSignPersonalMessage, useSuiClient, useCurrentAccount } from '@mysten/dapp-kit';
import { useParams } from 'react-router-dom';
import { Transaction } from '@mysten/sui/transactions';
import { fromHex } from '@mysten/sui/utils';
import { SealClient, SessionKey, EncryptedObject, NoAccessError } from '@mysten/seal';
import { ConfigService } from '../../services/config';
import { 
  Lock, 
  Unlock, 
  Eye, 
  Key, 
  AlertCircle, 
  Download, 
  X, 
  CheckCircle,
  User,
  Calendar,
  FileText,
  Shield,
  RefreshCw,
  ChevronRight,
  Hash,
  Clock
} from 'lucide-react';
import { set, get } from 'idb-keyval';
import '../../css/SurveyDecryption.css';

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

interface SurveyDecryptionProps {
  surveyId?: string;
  isCreator?: boolean;
}

export function SurveyDecryption(props: SurveyDecryptionProps) {
  const routeParams = useParams<{ surveyId: string }>();
  const surveyId = props.surveyId || routeParams.surveyId;
  const isCreator = props.isCreator || false;

  const currentAccount = useCurrentAccount();
  const suiClient = useSuiClient();
  const { mutate: signPersonalMessage } = useSignPersonalMessage();
  
  // Survey data
  const [surveyData, setSurveyData] = useState<any>(null);
  const [answerBlobs, setAnswerBlobs] = useState<AnswerBlob[]>([]);
  const [allowlist, setAllowlist] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  
  // Session key
  const [sessionKey, setSessionKey] = useState<SessionKey | null>(null);
  const [creatingSession, setCreatingSession] = useState(false);
  
  // Decryption state
  const [decryptingBlobId, setDecryptingBlobId] = useState<string | null>(null);
  const [decryptedAnswers, setDecryptedAnswers] = useState<Map<string, DecryptedAnswer>>(new Map());
  const [showDecryptedDialog, setShowDecryptedDialog] = useState(false);
  const [currentDecryptedAnswer, setCurrentDecryptedAnswer] = useState<DecryptedAnswer | null>(null);
  
  // Toast notifications
  const [toasts, setToasts] = useState<Array<{
    id: string;
    type: 'success' | 'error' | 'warning' | 'info';
    message: string;
  }>>([]);

  const showToast = (type: 'success' | 'error' | 'warning' | 'info', message: string) => {
    const id = Date.now().toString();
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(toast => toast.id !== id));
    }, 3000);
  };
  
  // Seal client
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

  const moveCallConstructor = (tx: Transaction, id: string) => {
    if (!surveyId) return;
    
    tx.moveCall({
      target: `${ConfigService.getPackageId()}::survey_system::seal_approve_allowlist`,
      arguments: [
        tx.pure.vector('u8', fromHex(id)),
        tx.object(surveyId),
      ],
    });
  };
  
  const loadSurveyData = async () => {
    if (!surveyId || !currentAccount?.address) return;
    
    setLoading(true);
    try {
      const surveyObject = await suiClient.getObject({
        id: surveyId,
        options: {
          showContent: true,
          showType: true,
        }
      });
      
      if (surveyObject.data?.content?.dataType === 'moveObject') {
        const fields = surveyObject.data.content.fields as any;
        setSurveyData(fields);
        
        let allowlistData: string[] = [];
        if (fields.allowlist?.fields?.contents) {
          allowlistData = fields.allowlist.fields.contents;
        } else if (Array.isArray(fields.allowlist)) {
          allowlistData = fields.allowlist;
        }
        setAllowlist(allowlistData);
        
        await loadAnswerBlobs(fields);
      }
    } catch (error) {
      console.error('Error loading survey:', error);
      showToast('error', 'Failed to load survey data');
    } finally {
      setLoading(false);
    }
  };
  
  const loadAnswerBlobs = async (surveyFields: any) => {
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
          
          if (fieldData.data?.content?.dataType === 'moveObject') {
            const value = (fieldData.data.content as any).fields?.value?.fields;
            if (value) {
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
    
    setAnswerBlobs(blobs.sort((a, b) => b.submittedAt - a.submittedAt));
  };
  
  const handleSessionKey = async () => {
    if (!currentAccount?.address || !signPersonalMessage) {
      showToast('error', 'Please connect wallet first');
      return;
    }
    
    setCreatingSession(true);
    
    try {
      const stored = await get('sessionKey');
      if (stored) {
        try {
          const imported = await SessionKey.import(stored as any, suiClient);
          if (!imported.isExpired() && imported.getAddress() === currentAccount.address) {
            setSessionKey(imported);
            showToast('success', 'Session key loaded');
            setCreatingSession(false);
            return;
          }
        } catch (e) {
          console.log('Stored session key expired or invalid');
        }
      }
      
      const newSessionKey = await SessionKey.create({
        address: currentAccount.address,
        packageId: ConfigService.getPackageId(),
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
            await set('sessionKey', newSessionKey.export());
            showToast('success', 'Session key created successfully');
            setCreatingSession(false);
          },
          onError: (error) => {
            console.error('Signing failed:', error);
            showToast('error', 'Failed to sign message');
            setCreatingSession(false);
          }
        }
      );
    } catch (error: any) {
      console.error('Session key error:', error);
      showToast('error', error.message);
      setCreatingSession(false);
    }
  };
  
  const downloadAndDecrypt = async (blobIds: string[]) => {
    if (!sessionKey || !surveyId) return;
    
    const aggregators = [
      'https://aggregator.walrus-testnet.walrus.space',
      'https://wal-aggregator-testnet.staketab.org',
      'https://walrus-testnet-aggregator.redundex.com',
      'https://walrus-testnet-aggregator.nodes.guru',
      'https://aggregator.walrus.banansen.dev',
      'https://walrus-testnet-aggregator.everstake.one',
    ];
    
    const downloadResults = await Promise.all(
      blobIds.map(async (blobId) => {
        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 10000);
          const randomAggregator = aggregators[Math.floor(Math.random() * aggregators.length)];
          const aggregatorUrl = `${randomAggregator}/v1/blobs/${blobId}`;
          const response = await fetch(aggregatorUrl, { signal: controller.signal });
          clearTimeout(timeout);
          if (!response.ok) {
            return null;
          }
          return { blobId, data: await response.arrayBuffer() };
        } catch (err) {
          console.error(`Blob ${blobId} could not be downloaded`, err);
          return null;
        }
      }),
    );

    const validDownloads = downloadResults.filter((result): result is { blobId: string; data: ArrayBuffer } => result !== null);
    
    if (validDownloads.length === 0) {
      throw new Error('Could not download any files');
    }

    for (let i = 0; i < validDownloads.length; i += 10) {
      const batch = validDownloads.slice(i, i + 10);
      const ids = batch.map((item) => EncryptedObject.parse(new Uint8Array(item.data)).id);
      const tx = new Transaction();
      ids.forEach((id) => moveCallConstructor(tx, id));
      const txBytes = await tx.build({ client: suiClient as any, onlyTransactionKind: true });
      
      try {
        await sealClient.fetchKeys({ ids, txBytes, sessionKey, threshold: 2 });
      } catch (err) {
        console.log(err);
        const errorMsg = err instanceof NoAccessError
          ? 'No access permission'
          : 'Could not decrypt files, please try again';
        throw new Error(errorMsg);
      }
    }

    const decryptedData: DecryptedAnswer[] = [];
    for (const { blobId, data } of validDownloads) {
      const fullId = EncryptedObject.parse(new Uint8Array(data)).id;
      const tx = new Transaction();
      moveCallConstructor(tx, fullId);
      const txBytes = await tx.build({ client: suiClient as any, onlyTransactionKind: true });
      
      try {
        const decryptedFile = await sealClient.decrypt({
          data: new Uint8Array(data),
          sessionKey,
          txBytes,
        });
        
        const answerJson = new TextDecoder().decode(decryptedFile);
        const answerData = JSON.parse(answerJson);
        
        const blob = answerBlobs.find(b => b.blobId === blobId);
        if (blob) {
          decryptedData.push({
            surveyId: answerData.surveyId,
            respondent: blob.respondent,
            timestamp: answerData.timestamp || blob.submittedAt,
            answers: answerData.answers,
            consent: answerData.consent || blob.consentForSubscription
          });
          
          decryptedAnswers.set(blobId, decryptedData[decryptedData.length - 1]);
        }
      } catch (err) {
        console.log(err);
        const errorMsg = err instanceof NoAccessError
          ? 'No access permission'
          : 'Could not decrypt file';
        console.error(errorMsg, err);
      }
    }

    if (decryptedData.length > 0) {
      setDecryptedAnswers(new Map(decryptedAnswers));
      showToast('success', `Successfully decrypted ${decryptedData.length} answer(s)`);
    }
  };
  
  const decryptAnswer = async (blob: AnswerBlob) => {
    if (!sessionKey || !currentAccount?.address) {
      showToast('warning', 'Please create session key first');
      return;
    }
    
    if (!allowlist.includes(currentAccount.address)) {
      showToast('error', 'You are not in the allowlist');
      return;
    }
    
    setDecryptingBlobId(blob.blobId);
    
    try {
      await downloadAndDecrypt([blob.blobId]);
      const decrypted = decryptedAnswers.get(blob.blobId);
      if (decrypted) {
        setCurrentDecryptedAnswer(decrypted);
        setShowDecryptedDialog(true);
      }
    } catch (error: any) {
      console.error('Decryption error:', error);
      showToast('error', error.message || 'Decryption failed');
    } finally {
      setDecryptingBlobId(null);
    }
  };

  const decryptAllAnswers = async () => {
    if (!sessionKey || !currentAccount?.address) {
      showToast('warning', 'Please create session key first');
      return;
    }
    
    if (!allowlist.includes(currentAccount.address)) {
      showToast('error', 'You are not in the allowlist');
      return;
    }

    setDecryptingBlobId('all');
    
    try {
      const blobIds = answerBlobs.map(b => b.blobId);
      await downloadAndDecrypt(blobIds);
    } catch (error: any) {
      console.error('Batch decryption error:', error);
      showToast('error', error.message || 'Batch decryption failed');
    } finally {
      setDecryptingBlobId(null);
    }
  };
  
  useEffect(() => {
    if (surveyId && currentAccount?.address) {
      loadSurveyData();
    }
  }, [surveyId, currentAccount?.address]);
  
  useEffect(() => {
    if (!currentAccount?.address || sessionKey) return;
    
    const loadExisting = async () => {
      try {
        const stored = await get('sessionKey');
        if (stored) {
          const imported = await SessionKey.import(stored as any, suiClient);
          if (!imported.isExpired() && imported.getAddress() === currentAccount.address) {
            setSessionKey(imported);
            showToast('info', 'Session key loaded automatically');
          }
        }
      } catch (e) {
        console.log('No valid stored session key');
      }
    };
    
    loadExisting();
  }, [currentAccount?.address]);
  
  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };
  
  const formatAnswer = (answer: any, questionType: number) => {
    if (questionType === 0) {
      return answer;
    } else if (questionType === 1) {
      return Array.isArray(answer) ? answer.join(', ') : answer;
    } else {
      return answer;
    }
  };
  
  const getQuestionTypeName = (type: number) => {
    switch(type) {
      case 0: return 'Single Choice';
      case 1: return 'Multiple Choice';
      case 2: return 'Text';
      default: return 'Unknown';
    }
  };
  
  const isInAllowlist = currentAccount?.address && allowlist.includes(currentAccount.address);
  
  if (!surveyId) {
    return (
      <div className="sd-error-state">
        <AlertCircle size={48} />
        <h3>No Survey ID Provided</h3>
        <p>Please provide a valid survey ID to decrypt answers</p>
      </div>
    );
  }
  
  if (loading) {
    return (
      <div className="sd-loading">
        <div className="sd-loading-spinner"></div>
        <div className="sd-loading-text">Loading survey data...</div>
      </div>
    );
  }
  
  return (
    <div className="sd-container">
      {/* Status Header */}
      <div className="sd-header">
        <div className="sd-header-content">
          <div className="sd-header-left">
            <h3 className="sd-title">Survey Decryption Panel</h3>
            {surveyData && (
              <p className="sd-subtitle">{surveyData.title}</p>
            )}
          </div>
          
          <div className="sd-header-badges">
            <div className={`sd-badge ${isInAllowlist ? 'success' : 'error'}`}>
              <Shield size={14} />
              {isInAllowlist ? 'In Allowlist' : 'Not in Allowlist'}
            </div>
            <div className={`sd-badge ${sessionKey ? 'success' : 'warning'}`}>
              <Key size={14} />
              {sessionKey ? 'Session Ready' : 'No Session'}
            </div>
            <div className="sd-badge info">
              <FileText size={14} />
              {answerBlobs.length} Answers
            </div>
            {isCreator && (
              <div className="sd-badge purple">
                <User size={14} />
                Creator
              </div>
            )}
          </div>
        </div>
        
        <div className="sd-header-actions">
          {!sessionKey && (
            <button
              className="sd-btn primary"
              onClick={handleSessionKey}
              disabled={creatingSession}
            >
              {creatingSession ? (
                <>
                  <RefreshCw size={16} className="sd-spinning" />
                  Creating...
                </>
              ) : (
                <>
                  <Key size={16} />
                  Create Session Key
                </>
              )}
            </button>
          )}
          
          {sessionKey && isInAllowlist && answerBlobs.length > 0 && (
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
                  <Download size={16} />
                  Decrypt All Answers ({answerBlobs.length})
                </>
              )}
            </button>
          )}
          
          <button
            className="sd-btn secondary"
            onClick={() => loadSurveyData()}
          >
            <RefreshCw size={16} />
            Refresh
          </button>
        </div>
        
        {sessionKey && !isInAllowlist && (
          <div className="sd-warning-banner">
            <AlertCircle size={16} />
            <span>You are not in the allowlist and cannot decrypt answers</span>
          </div>
        )}
      </div>
      
      {/* Answers Grid */}
      <div className="sd-answers-section">
        <div className="sd-section-header">
          <h4>Submitted Answers</h4>
          <div className="sd-section-stats">
            <span className="sd-stat">
              <CheckCircle size={14} />
              {decryptedAnswers.size} Decrypted
            </span>
            <span className="sd-stat">
              <Lock size={14} />
              {answerBlobs.length - decryptedAnswers.size} Encrypted
            </span>
          </div>
        </div>
        
        {answerBlobs.length === 0 ? (
          <div className="sd-empty-state">
            <FileText size={48} />
            <h4>No Answers Yet</h4>
            <p>No answers have been submitted for this survey</p>
          </div>
        ) : (
          <div className="sd-answers-grid">
            {answerBlobs.map((blob, idx) => {
              const isDecrypted = decryptedAnswers.has(blob.blobId);
              const isDecrypting = decryptingBlobId === blob.blobId;
              
              return (
                <div key={blob.blobId} className="sd-answer-card">
                  <div className="sd-answer-header">
                    <div className="sd-answer-title">
                      <Hash size={16} />
                      <span>Answer #{idx + 1}</span>
                      {isDecrypted && (
                        <div className="sd-mini-badge success">Decrypted</div>
                      )}
                      {blob.consentForSubscription && (
                        <div className="sd-mini-badge info">Consented</div>
                      )}
                    </div>
                    <div className="sd-answer-actions">
                      {isDecrypted && (
                        <button
                          className="sd-icon-btn"
                          onClick={() => {
                            setCurrentDecryptedAnswer(decryptedAnswers.get(blob.blobId)!);
                            setShowDecryptedDialog(true);
                          }}
                          title="View decrypted answer"
                        >
                          <Eye size={16} />
                        </button>
                      )}
                      <button
                        className={`sd-icon-btn ${!isDecrypted ? 'primary' : ''}`}
                        onClick={() => decryptAnswer(blob)}
                        disabled={!sessionKey || !isInAllowlist || isDecrypting}
                        title={isDecrypted ? 'Re-decrypt' : 'Decrypt answer'}
                      >
                        {isDecrypting ? (
                          <RefreshCw size={16} className="sd-spinning" />
                        ) : isDecrypted ? (
                          <Unlock size={16} />
                        ) : (
                          <Lock size={16} />
                        )}
                      </button>
                    </div>
                  </div>
                  
                  <div className="sd-answer-details">
                    <div className="sd-detail-item">
                      <User size={12} />
                      <span className="sd-detail-label">Respondent:</span>
                      <code>{blob.respondent.slice(0, 6)}...{blob.respondent.slice(-4)}</code>
                    </div>
                    <div className="sd-detail-item">
                      <Clock size={12} />
                      <span className="sd-detail-label">Submitted:</span>
                      <span>{formatTimestamp(blob.submittedAt)}</span>
                    </div>
                    <div className="sd-detail-item">
                      <FileText size={12} />
                      <span className="sd-detail-label">Blob ID:</span>
                      <code>{blob.blobId.slice(0, 8)}...</code>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      
      {/* Decrypted Answer Modal */}
      {showDecryptedDialog && currentDecryptedAnswer && (
        <div className="sd-modal-overlay" onClick={() => setShowDecryptedDialog(false)}>
          <div className="sd-modal" onClick={e => e.stopPropagation()}>
            <div className="sd-modal-header">
              <h2 className="sd-modal-title">Decrypted Answer Details</h2>
              <button 
                className="sd-modal-close" 
                onClick={() => setShowDecryptedDialog(false)}
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="sd-modal-info">
              <div className="sd-info-grid">
                <div className="sd-info-item">
                  <User size={16} />
                  <div>
                    <span className="sd-info-label">Respondent</span>
                    <code className="sd-info-value">
                      {currentDecryptedAnswer.respondent.slice(0, 10)}...{currentDecryptedAnswer.respondent.slice(-8)}
                    </code>
                  </div>
                </div>
                <div className="sd-info-item">
                  <Calendar size={16} />
                  <div>
                    <span className="sd-info-label">Submitted</span>
                    <span className="sd-info-value">
                      {formatTimestamp(currentDecryptedAnswer.timestamp)}
                    </span>
                  </div>
                </div>
                <div className="sd-info-item">
                  <Shield size={16} />
                  <div>
                    <span className="sd-info-label">Data Consent</span>
                    <div className={`sd-consent-badge ${currentDecryptedAnswer.consent ? 'granted' : 'denied'}`}>
                      {currentDecryptedAnswer.consent ? 'Granted' : 'Not Granted'}
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="sd-modal-content">
              <h3 className="sd-answers-title">Survey Responses</h3>
              
              <div className="sd-answers-list">
                {currentDecryptedAnswer.answers.map((ans, idx) => (
                  <div key={idx} className="sd-answer-item">
                    <div className="sd-question-header">
                      <div className="sd-question-number">Q{ans.questionIndex + 1}</div>
                      <div className="sd-question-type">
                        {getQuestionTypeName(ans.questionType)}
                      </div>
                    </div>
                    
                    <div className="sd-question-text">
                      {ans.questionText}
                    </div>
                    
                    <div className="sd-answer-content">
                      <ChevronRight size={16} className="sd-answer-icon" />
                      <div className="sd-answer-value">
                        {formatAnswer(ans.answer, ans.questionType)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="sd-modal-actions">
              <button 
                className="sd-btn secondary"
                onClick={() => setShowDecryptedDialog(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Toast Notifications */}
      <div className="sd-toast-container">
        {toasts.map(toast => (
          <div key={toast.id} className={`sd-toast ${toast.type}`}>
            {toast.type === 'success' && <CheckCircle size={16} />}
            {toast.type === 'error' && <AlertCircle size={16} />}
            {toast.type === 'warning' && <AlertCircle size={16} />}
            {toast.type === 'info' && <AlertCircle size={16} />}
            <span>{toast.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default SurveyDecryption;