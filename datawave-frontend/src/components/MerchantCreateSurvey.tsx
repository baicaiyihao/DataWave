// Create Survey Component - Optimized Version
// 使用 create_survey_with_questions_entry 创建问卷

import React, { useState, useEffect } from 'react';
import { Button, Card, Flex, TextField, Text, TextArea, Badge } from '@radix-ui/themes';
import { useSignAndExecuteTransaction, useSuiClient, useCurrentAccount } from '@mysten/dapp-kit';
import { Transaction } from "@mysten/sui/transactions";
import { ConfigService } from '../services/config';
import { Trash2, Plus, Coins } from 'lucide-react';

// 问题类型枚举
enum QuestionType {
  SINGLE_CHOICE = 0,
  MULTIPLE_CHOICE = 1,
  TEXT = 2
}

// 问题接口
interface Question {
  text: string;
  type: QuestionType;
  options: string[];
}

export function MerchantCreateSurveyOptimized() {
  const currentAccount = useCurrentAccount();
  const suiClient = useSuiClient();
  const packageId = ConfigService.getPackageId();
  
  // 基本信息状态
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [rewardPerResponse, setRewardPerResponse] = useState('1000000000'); // 1 SUI
  const [maxResponses, setMaxResponses] = useState('100');
  
  // 问题管理状态
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState<Question>({
    text: '',
    type: QuestionType.SINGLE_CHOICE,
    options: []
  });
  const [currentOption, setCurrentOption] = useState('');
  
  // UI状态
  const [isCreating, setIsCreating] = useState(false);
  const [showQuestionForm, setShowQuestionForm] = useState(false);
  const [userBalance, setUserBalance] = useState<number | null>(null);
  
  const { mutateAsync: signAndExecute } = useSignAndExecuteTransaction();
  
  // 获取用户余额
  const getUserBalance = async () => {
    if (!currentAccount?.address) return;
    
    try {
      const coins = await suiClient.getCoins({
        owner: currentAccount.address,
        coinType: '0x2::sui::SUI'
      });
      
      const total = coins.data.reduce((sum, coin) => 
        sum + parseInt(coin.balance), 0
      );
      setUserBalance(total);
    } catch (error) {
      console.error('Error fetching balance:', error);
    }
  };
  
  // 组件加载时获取余额
  useEffect(() => {
    getUserBalance();
  }, [currentAccount?.address]);
  
  // 添加选项到当前问题
  const addOptionToCurrentQuestion = () => {
    if (currentOption.trim() && currentQuestion.type !== QuestionType.TEXT) {
      setCurrentQuestion({
        ...currentQuestion,
        options: [...currentQuestion.options, currentOption.trim()]
      });
      setCurrentOption('');
    }
  };
  
  // 删除选项
  const removeOptionFromCurrentQuestion = (index: number) => {
    setCurrentQuestion({
      ...currentQuestion,
      options: currentQuestion.options.filter((_, i) => i !== index)
    });
  };
  
  // 添加问题到列表
  const addQuestion = () => {
    if (!currentQuestion.text.trim()) {
      alert('Please enter question text');
      return;
    }
    
    if (currentQuestion.type === QuestionType.TEXT) {
      setQuestions([...questions, { ...currentQuestion, options: [] }]);
    } else {
      if (currentQuestion.options.length < 2) {
        alert('Please add at least 2 options for choice questions');
        return;
      }
      setQuestions([...questions, currentQuestion]);
    }
    
    // 重置当前问题
    setCurrentQuestion({
      text: '',
      type: QuestionType.SINGLE_CHOICE,
      options: []
    });
    setCurrentOption('');
    setShowQuestionForm(false);
  };
  
  // 删除问题
  const removeQuestion = (index: number) => {
    setQuestions(questions.filter((_, i) => i !== index));
  };
  
  // 创建问卷
  const handleCreateSurvey = async () => {
    // 验证
    if (!title || !description || !category) {
      alert('Please fill in all survey information');
      return;
    }
    
    if (questions.length === 0) {
      alert('Please add at least one question');
      return;
    }
    
    if (!currentAccount?.address) {
      alert('Please connect your wallet');
      return;
    }
    
    setIsCreating(true);
    
    try {
      const tx = new Transaction();
      
      // 准备数据
      const titleBytes = Array.from(new TextEncoder().encode(title));
      const descriptionBytes = Array.from(new TextEncoder().encode(description));
      const categoryBytes = Array.from(new TextEncoder().encode(category));
      
      const questionTexts: number[][] = questions.map(q => 
        Array.from(new TextEncoder().encode(q.text))
      );
      
      const questionTypes: number[] = questions.map(q => q.type);
      
      const questionOptions: number[][][] = questions.map(q => {
        if (q.type === QuestionType.TEXT) {
          return [];
        }
        return q.options.map(opt => 
          Array.from(new TextEncoder().encode(opt))
        );
      });
      
      // 计算总金额
      const totalRequired = parseInt(rewardPerResponse) * parseInt(maxResponses);
      const totalWithBuffer = totalRequired + 100000000; // 加 0.1 SUI 缓冲
      
      console.log('Creating survey:', {
        title,
        category,
        questions: questions.length,
        totalCost: (totalRequired / 1000000000).toFixed(3) + ' SUI'
      });
      
      // 从 gas 中分割支付
      const [paymentCoin] = tx.splitCoins(tx.gas, [totalWithBuffer]);
      
      // 调用合约
      tx.moveCall({
        target: `${packageId}::survey_system::create_survey_with_questions_entry`,
        arguments: [
          tx.pure('vector<u8>', titleBytes),
          tx.pure('vector<u8>', descriptionBytes),
          tx.pure('vector<u8>', categoryBytes),
          tx.pure('vector<vector<u8>>', questionTexts),
          tx.pure('vector<u8>', questionTypes),
          tx.pure('vector<vector<vector<u8>>>', questionOptions),
          tx.pure.u64(parseInt(rewardPerResponse)),
          tx.pure.u64(parseInt(maxResponses)),
          paymentCoin,
          tx.object(ConfigService.getSurveyRegistryId()),
          tx.object('0x6') // Clock
        ],
      });
      
      tx.setGasBudget(1000000000);
      
      // 执行交易
      const result = await signAndExecute({ transaction: tx as any});
      
      console.log('Transaction result:', result);
      
      if (result && result.digest) {
        console.log('Transaction successful! Digest:', result.digest);
        
        // 等待链上同步
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        try {
          // 获取交易详情
          const txDetails = await suiClient.getTransactionBlock({
            digest: result.digest,
            options: {
              showObjectChanges: true,
            }
          });
          
          // 查找创建的 Survey ID
          let surveyId: string | null = null;
          
          if (txDetails.objectChanges) {
            for (const change of txDetails.objectChanges) {
              if (change.type === 'created' && 
                  change.objectType?.includes('::survey_system::Survey')) {
                surveyId = change.objectId;
                break;
              }
            }
          }
          
          if (surveyId) {
            // 保存到 localStorage
            const surveyData = {
              id: surveyId,
              title,
              description,
              category,
              questions,
              rewardPerResponse,
              maxResponses,
              createdAt: new Date().toISOString(),
              creator: currentAccount.address,
              digest: result.digest
            };
            
            localStorage.setItem(`survey_${surveyId}`, JSON.stringify(surveyData));
            
            const surveyIndex = JSON.parse(localStorage.getItem('survey_index') || '[]');
            if (!surveyIndex.includes(surveyId)) {
              surveyIndex.push(surveyId);
              localStorage.setItem('survey_index', JSON.stringify(surveyIndex));
            }
            
            // 询问是否查看详情
            const viewDetails = window.confirm(
              `✅ Survey Created Successfully!\n\n` +
              `Title: ${title}\n` +
              `Survey ID: ${surveyId.slice(0, 16)}...\n` +
              `Reward: ${(parseInt(rewardPerResponse) / 1000000000).toFixed(3)} SUI per response\n\n` +
              `Would you like to view the survey details?`
            );
            
            // 重置表单
            setTitle('');
            setDescription('');
            setCategory('');
            setQuestions([]);
            setRewardPerResponse('1000000000');
            setMaxResponses('100');
            
            if (viewDetails) {
              // 发送事件通知 App.tsx
              const event = new CustomEvent('viewSurveyDetails', { 
                detail: { surveyId } 
              });
              window.dispatchEvent(event);
            }
            
          } else {
            alert(
              `✅ Survey created successfully!\n\n` +
              `Transaction: ${result.digest}\n\n` +
              `View on explorer:\n` +
              `https://suiscan.xyz/testnet/tx/${result.digest}`
            );
          }
          
        } catch (error) {
          console.error('Error fetching transaction details:', error);
          alert(`✅ Survey created!\nTransaction: ${result.digest}`);
        }
        
        // 重置表单
        setTitle('');
        setDescription('');
        setCategory('');
        setQuestions([]);
        
      } else {
        alert('Transaction failed. Please try again.');
      }
      
    } catch (error: any) {
      console.error('Error creating survey:', error);
      alert(`Error: ${error.message || 'Unknown error'}`);
    } finally {
      setIsCreating(false);
    }
  };
  
  // 计算成本
  const totalCost = (parseInt(rewardPerResponse) * parseInt(maxResponses)) / 1000000000;
  const isBalanceSufficient = userBalance !== null && userBalance >= (totalCost * 1000000000);
  
  return (
    <Flex direction="column" gap="3" style={{ maxWidth: '800px', margin: '0 auto' }}>
      {/* Header */}
      <Card>
        <Flex direction="column" gap="3">
          <Text size="5" weight="bold">Create Survey</Text>
          
          {/* Balance Display */}
          {userBalance !== null && (
            <Card style={{ backgroundColor: 'var(--gray-2)' }}>
              <Flex justify="between" align="center">
                <Flex align="center" gap="2">
                  <Coins size={16} />
                  <Text size="2">Wallet Balance:</Text>
                </Flex>
                <Text size="2" weight="bold" color={isBalanceSufficient ? 'green' : 'red'}>
                  {(userBalance / 1000000000).toFixed(3)} SUI
                </Text>
              </Flex>
            </Card>
          )}
          
          {/* Basic Info */}
          <TextField.Root
            placeholder="Survey Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            size="3"
          />
          
          <TextArea
            placeholder="Survey Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
          />
          
          <TextField.Root
            placeholder="Category (e.g., feedback, research, marketing)"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          />
          
          {/* Reward Settings */}
          <Flex gap="3">
            <div style={{ flex: 1 }}>
              <Text size="2" color="gray">Reward per Response (MIST)</Text>
              <TextField.Root
                value={rewardPerResponse}
                onChange={(e) => setRewardPerResponse(e.target.value)}
              />
              <Text size="1" color="gray">
                = {(parseInt(rewardPerResponse || '0') / 1000000000).toFixed(3)} SUI
              </Text>
            </div>
            
            <div style={{ flex: 1 }}>
              <Text size="2" color="gray">Maximum Responses</Text>
              <TextField.Root
                value={maxResponses}
                onChange={(e) => setMaxResponses(e.target.value)}
              />
            </div>
          </Flex>
          
          {/* Cost Summary */}
          <Card style={{ backgroundColor: 'var(--blue-2)' }}>
            <Flex justify="between" align="center">
              <Text size="2" weight="bold">Total Cost:</Text>
              <Text size="3" weight="bold" color="blue">
                {totalCost.toFixed(3)} SUI
              </Text>
            </Flex>
            <Text size="1" color="gray">
              (+ ~0.1 SUI for gas)
            </Text>
          </Card>
        </Flex>
      </Card>
      
      {/* Questions Management */}
      <Card>
        <Flex direction="column" gap="3">
          <Flex justify="between" align="center">
            <Text size="3" weight="bold">Questions ({questions.length})</Text>
            <Button 
              onClick={() => setShowQuestionForm(!showQuestionForm)} 
              variant="soft"
            >
              <Plus size={16} /> Add Question
            </Button>
          </Flex>
          
          {/* Add Question Form */}
          {showQuestionForm && (
            <Card style={{ backgroundColor: 'var(--gray-2)' }}>
              <Flex direction="column" gap="2">
                <TextField.Root
                  placeholder="Enter your question"
                  value={currentQuestion.text}
                  onChange={(e) => setCurrentQuestion({ ...currentQuestion, text: e.target.value })}
                />
                
                <select
                  value={currentQuestion.type}
                  onChange={(e) => setCurrentQuestion({ 
                    ...currentQuestion, 
                    type: parseInt(e.target.value) as QuestionType,
                    options: []
                  })}
                  style={{ padding: '8px', borderRadius: '4px', border: '1px solid var(--gray-6)' }}
                >
                  <option value={QuestionType.SINGLE_CHOICE}>Single Choice</option>
                  <option value={QuestionType.MULTIPLE_CHOICE}>Multiple Choice</option>
                  <option value={QuestionType.TEXT}>Text Answer</option>
                </select>
                
                {/* Options Management */}
                {currentQuestion.type !== QuestionType.TEXT && (
                  <>
                    <Flex gap="2">
                      <TextField.Root
                        placeholder="Add an option"
                        value={currentOption}
                        onChange={(e) => setCurrentOption(e.target.value)}
                        style={{ flex: 1 }}
                      />
                      <Button onClick={addOptionToCurrentQuestion} size="2">
                        Add
                      </Button>
                    </Flex>
                    
                    {currentQuestion.options.map((opt, idx) => (
                      <Flex key={idx} justify="between" align="center">
                        <Text size="2">• {opt}</Text>
                        <Button
                          size="1"
                          variant="ghost"
                          color="red"
                          onClick={() => removeOptionFromCurrentQuestion(idx)}
                        >
                          <Trash2 size={14} />
                        </Button>
                      </Flex>
                    ))}
                  </>
                )}
                
                <Flex gap="2" justify="end">
                  <Button onClick={() => setShowQuestionForm(false)} variant="soft">
                    Cancel
                  </Button>
                  <Button onClick={addQuestion}>
                    Save Question
                  </Button>
                </Flex>
              </Flex>
            </Card>
          )}
          
          {/* Questions List */}
          {questions.map((q, index) => (
            <Card key={index} style={{ backgroundColor: 'var(--gray-1)' }}>
              <Flex justify="between">
                <div style={{ flex: 1 }}>
                  <Flex align="center" gap="2" mb="1">
                    <Text size="2" weight="bold">Q{index + 1}:</Text>
                    <Badge size="1" color={q.type === QuestionType.TEXT ? 'green' : 'blue'}>
                      {['Single Choice', 'Multiple Choice', 'Text'][q.type]}
                    </Badge>
                  </Flex>
                  <Text size="2">{q.text}</Text>
                  {q.options.length > 0 && (
                    <Flex direction="column" gap="1" mt="2">
                      {q.options.map((opt, optIdx) => (
                        <Text key={optIdx} size="1" color="gray">
                          {optIdx + 1}. {opt}
                        </Text>
                      ))}
                    </Flex>
                  )}
                </div>
                <Button 
                  size="1" 
                  variant="ghost" 
                  color="red" 
                  onClick={() => removeQuestion(index)}
                >
                  <Trash2 size={16} />
                </Button>
              </Flex>
            </Card>
          ))}
          
          {questions.length === 0 && !showQuestionForm && (
            <Text size="2" color="gray" align="center">
              No questions yet. Click "Add Question" to start.
            </Text>
          )}
        </Flex>
      </Card>
      
      {/* Create Button */}
      <Card>
        <Button
          size="3"
          onClick={handleCreateSurvey}
          disabled={isCreating || questions.length === 0 || !currentAccount || !isBalanceSufficient}
          style={{ width: '100%' }}
        >
          {isCreating ? 'Creating Survey...' : `Create Survey (Cost: ${totalCost.toFixed(3)} SUI)`}
        </Button>
        
        {!currentAccount && (
          <Text size="2" color="red" align="center" style={{ marginTop: '8px' }}>
            Please connect your wallet
          </Text>
        )}
        
        {currentAccount && !isBalanceSufficient && (
          <Text size="2" color="red" align="center" style={{ marginTop: '8px' }}>
            Insufficient balance. Need at least {totalCost.toFixed(3)} SUI
          </Text>
        )}
      </Card>
    </Flex>
  );
}