// Copyright (c) 2025, DataWave Survey Platform
// SPDX-License-Identifier: Apache-2.0

import { useEffect, useState } from 'react';
import { useSignPersonalMessage, useSuiClient, useCurrentAccount } from '@mysten/dapp-kit';
import { AlertDialog, Button, Card, Dialog, Flex } from '@radix-ui/themes';
import { fromHex } from '@mysten/sui/utils';
import { Transaction } from '@mysten/sui/transactions';
import {
  SealClient,
  SessionKey,
  type ExportedSessionKey
} from '@mysten/seal';
import { useParams, useNavigate } from 'react-router-dom';
import { downloadAndDecrypt, getObjectExplorerLink, MoveCallConstructor } from './utils';
import { set, get } from 'idb-keyval';
import { ConfigService } from '../services/config';

const TTL_MIN = 10;

interface SurveyAnswer {
  respondent: string;
  blobId: string;
  sealKeyId: string;
  submittedAt: number;
  consent: boolean;
  decryptedContent?: any;
}

interface SurveyDetails {
  title: string;
  description: string;
  questions: any[];
  responseCount: number;
}

function constructMoveCall(
  packageId: string,
  subscriptionId: string,
  serviceId: string,
  surveyId: string
): MoveCallConstructor {
  return (tx: Transaction, id: string) => {
    tx.moveCall({
      target: `${packageId}::survey_system::seal_approve_subscription`,
      arguments: [
        tx.pure.vector('u8', fromHex(id)),
        tx.object(subscriptionId), // Subscription NFT
        tx.object(serviceId), // SubscriptionService
        tx.object(surveyId), // Survey
        tx.object('0x6'), // Clock
      ],
    });
  };
}

export function ViewSubscriptionAnswers() {
  const { surveyId, subscriptionId } = useParams();
  const suiClient = useSuiClient();
  const currentAccount = useCurrentAccount();
  const navigate = useNavigate();
  
  const serverObjectIds = [
    "0x73d05d62c18d9374e3ea529e8e0ed6161da1a141a94d3f76ae3fe4e99356db75",
    "0xf5d14a81a982144ae441cd7d64b09027f116a468bd36e7eca494f750591623c8"
  ];
  
  const client = new SealClient({
    suiClient,
    serverConfigs: serverObjectIds.map((id) => ({
      objectId: id,
      weight: 1,
    })),
    verifyKeyServers: false,
  });
  
  const packageId = ConfigService.getPackageId();
  const mvrName = useNetworkVariable('mvrName');
  
  const [survey, setSurvey] = useState<SurveyDetails | null>(null);
  const [answers, setAnswers] = useState<SurveyAnswer[]>([]);
  const [serviceId, setServiceId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [decrypting, setDecrypting] = useState(false);
  const [sessionKey, setSessionKey] = useState<SessionKey | undefined>(undefined);
  const [isRequestingDecryption, setIsRequestingDecryption] = useState(false);
  
  const { mutate: signPersonalMessage } = useSignPersonalMessage();

  useEffect(() => {
    async function loadSurveyData() {
      if (!surveyId || !subscriptionId || !currentAccount?.address) return;
      
      try {
        // Get subscription details
        const subscription = await suiClient.getObject({
          id: subscriptionId,
          options: { showContent: true },
        });
        
        const subFields = (subscription.data?.content as { fields: any })?.fields;
        if (!subFields) {
          console.error('Invalid subscription');
          return;
        }
        
        setServiceId(subFields.service_id);
        
        // Get survey details
        const surveyObj = await suiClient.getObject({
          id: surveyId,
          options: { showContent: true },
        });
        
        const surveyFields = (surveyObj.data?.content as { fields: any })?.fields;
        if (!surveyFields) {
          console.error('Survey not found');
          return;
        }
        
        setSurvey({
          title: surveyFields.title,
          description: surveyFields.description,
          questions: surveyFields.questions || [],
          responseCount: parseInt(surveyFields.current_responses || '0'),
        });
        
        // Get all answer blob IDs from survey
        const answerBlobs: SurveyAnswer[] = [];
        
        // Get consenting users who provided answers
        const consentingUsers = surveyFields.consenting_users || [];
        
        for (const respondent of consentingUsers) {
          // In a real implementation, you'd query the encrypted_answer_blobs table
          // For now, we'll get blob IDs from dynamic fields
          const dynamicFields = await suiClient.getDynamicFields({
            parentId: surveyId,
          });
          
          for (const field of dynamicFields.data) {
            if (field.name.type === 'vector<u8>' && field.objectType === 'u64') {
              // This is a blob ID marker
              const blobId = field.name.value;
              answerBlobs.push({
                respondent,
                blobId: blobId as string,
                sealKeyId: '', // Would get from encrypted_answer_blobs
                submittedAt: Date.now(), // Would get from encrypted_answer_blobs
                consent: true,
              });
            }
          }
        }
        
        setAnswers(answerBlobs);
        
        // Load session key from cache if exists
        const cachedKey = await get(`session_key_${surveyId}`);
        if (cachedKey) {
          const key = SessionKey.fromExportedValue(cachedKey);
          setSessionKey(key);
        }
        
      } catch (error) {
        console.error('Error loading survey data:', error);
      } finally {
        setLoading(false);
      }
    }
    
    loadSurveyData();
  }, [surveyId, subscriptionId, currentAccount?.address, suiClient]);

  const requestDecryption = async () => {
    if (!surveyId || !subscriptionId || !serviceId) return;
    
    setIsRequestingDecryption(true);
    
    try {
      const moveCall = constructMoveCall(packageId, subscriptionId, serviceId, surveyId);
      
      const sessionKeyResult = await client.createSession({
        suiAddress: currentAccount!.address,
        accessPolicy: { kind: 'Move', moveCall },
        namespace: fromHex(surveyId),
        name: mvrName,
        ttlMinutes: TTL_MIN,
        signPersonalMessage: async (message, address) => {
          return new Promise((resolve, reject) => {
            signPersonalMessage(
              { message: new TextEncoder().encode(message), account: address },
              {
                onSuccess: ({ signature }) => {
                  resolve(signature);
                },
                onError: (error) => {
                  reject(error);
                },
              },
            );
          });
        },
      });
      
      setSessionKey(sessionKeyResult.sessionKey);
      
      // Cache the session key
      await set(
        `session_key_${surveyId}`,
        sessionKeyResult.sessionKey.toExportedValue()
      );
      
      setIsRequestingDecryption(false);
    } catch (error) {
      console.error('Error requesting decryption:', error);
      setIsRequestingDecryption(false);
    }
  };

  const decryptAnswer = async (blobId: string) => {
    if (!sessionKey) {
      alert('Please request decryption access first');
      return;
    }
    
    setDecrypting(true);
    
    try {
      // Download and decrypt the blob
      const decryptedData = await downloadAndDecrypt(client, sessionKey, blobId);
      
      // Update the answer with decrypted content
      setAnswers(prev => prev.map(a => 
        a.blobId === blobId 
          ? { ...a, decryptedContent: decryptedData }
          : a
      ));
      
      console.log('Decrypted answer:', decryptedData);
    } catch (error) {
      console.error('Error decrypting answer:', error);
      alert('Failed to decrypt answer. Please check your subscription status.');
    } finally {
      setDecrypting(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <p>Loading survey answers...</p>
      </Card>
    );
  }

  if (!survey) {
    return (
      <Card>
        <p>Survey not found</p>
        <Button onClick={() => navigate('/survey-subscription/my-subscriptions')}>
          Back to My Subscriptions
        </Button>
      </Card>
    );
  }

  return (
    <Flex direction="column" gap="3">
      <Card>
        <Flex justify="between" align="center">
          <div>
            <h2>{survey.title}</h2>
            <p style={{ color: 'var(--gray-11)' }}>{survey.description}</p>
          </div>
          <Button 
            variant="soft" 
            onClick={() => navigate('/survey-subscription/my-subscriptions')}
          >
            Back
          </Button>
        </Flex>
      </Card>

      <Card>
        <Flex direction="column" gap="2">
          <h3>Survey Statistics</h3>
          <p><strong>Total Responses:</strong> {survey.responseCount}</p>
          <p><strong>Consenting Users:</strong> {answers.length}</p>
          <p><strong>Questions:</strong> {survey.questions.length}</p>
        </Flex>
      </Card>

      <Card>
        <Flex direction="column" gap="3">
          <Flex justify="between" align="center">
            <h3>Survey Answers ({answers.length})</h3>
            {!sessionKey ? (
              <Button
                onClick={requestDecryption}
                disabled={isRequestingDecryption}
              >
                {isRequestingDecryption ? 'Requesting Access...' : 'Request Decryption Access'}
              </Button>
            ) : (
              <Card style={{ backgroundColor: 'var(--green-3)' }}>
                <p>✓ Decryption Access Granted</p>
              </Card>
            )}
          </Flex>

          {answers.length === 0 ? (
            <p>No answers available yet</p>
          ) : (
            <Flex direction="column" gap="2">
              {answers.map((answer, index) => (
                <Card key={answer.blobId} style={{ backgroundColor: 'var(--gray-2)' }}>
                  <Flex direction="column" gap="2">
                    <Flex justify="between" align="center">
                      <div>
                        <p><strong>Response #{index + 1}</strong></p>
                        <p style={{ fontSize: '0.85em', color: 'var(--gray-11)' }}>
                          From: {answer.respondent.slice(0, 16)}...
                        </p>
                        <p style={{ fontSize: '0.85em', color: 'var(--gray-11)' }}>
                          Blob ID: {answer.blobId.slice(0, 20)}...
                        </p>
                      </div>
                      <Button
                        size="2"
                        onClick={() => decryptAnswer(answer.blobId)}
                        disabled={!sessionKey || decrypting}
                      >
                        {answer.decryptedContent ? 'View Decrypted' : 
                         decrypting ? 'Decrypting...' : 'Decrypt Answer'}
                      </Button>
                    </Flex>
                    
                    {answer.decryptedContent && (
                      <Card style={{ backgroundColor: 'var(--gray-1)' }}>
                        <pre style={{ fontSize: '0.85em', overflow: 'auto' }}>
                          {JSON.stringify(answer.decryptedContent, null, 2)}
                        </pre>
                      </Card>
                    )}
                  </Flex>
                </Card>
              ))}
            </Flex>
          )}
        </Flex>
      </Card>
    </Flex>
  );
}