// App.tsx - 修复钱包持久化的版本
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { SuiClientProvider, WalletProvider } from '@mysten/dapp-kit';
import { getFullnodeUrl } from '@mysten/sui/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '@mysten/dapp-kit/dist/index.css';

// Landing Page
import HomePage from './pages/HomePage';

// Layout
import AppLayout from './components/Layout/AppLayout';



// Respondents Components
import ViewAllSurveys from './components/Respondents/ViewAllSurveys';
import AnswerSurvey from './components/Respondents/AnswerSurvey';
import MyAnsweredSurveys from './components/Respondents/MyAnsweredSurveys';

// Enterprises Components  
import MerchantCreateSurvey from './components/Enterprises/MerchantCreateSurvey';
import MySurveys from './components/Enterprises/MySurveys';
import SurveyManagementPage from './components/Enterprises/SurveyManagementPage';
import SurveyDecryption from './components/Enterprises/SurveyDecryption';

// Marketplace Components
import BrowseSubscriptions from './components/Marketplace/BrowseSubscriptions';
import MySubscriptions from './components/Marketplace/MySubscriptions';
import SubscriptionDecrypt from './components/Marketplace/SubscriptionDecrypt';

// Shared Components
import MyAllowlistAccess from './components/Shared/MyAllowlistAccess';
import ViewSurveyDetails from './components/Shared/ViewSurveyDetails';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 60 * 1000, // 1 minute
    },
  },
});


function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <SuiClientProvider networks={{ testnet: { url: getFullnodeUrl('testnet') } }} defaultNetwork="testnet">
        <WalletProvider 
          autoConnect={true}
        >
          <Router>
            <Routes>
              <Route path="/" element={<HomePage />} />
              
              <Route path="/app" element={<AppLayout />}>
                
                {/* Respondent Routes */}
                <Route path="marketplace" element={<ViewAllSurveys />} />
                <Route path="answer/:surveyId" element={<AnswerSurvey />} />
                <Route path="my-responses" element={<MyAnsweredSurveys />} />
                <Route path="earnings" element={<MyAnsweredSurveys />} />
                
                {/* Enterprise Routes */}
                <Route path="create-survey" element={<MerchantCreateSurvey />} />
                <Route path="my-surveys" element={<MySurveys />} />
                <Route path="manage/:surveyId" element={<SurveyManagementPage />} />
                <Route path="analytics/:surveyId" element={<SurveyDecryption />} />
                
                {/* Subscription Routes */}
                <Route path="subscriptions" element={<BrowseSubscriptions />} />
                <Route path="my-subscriptions" element={<MySubscriptions />} />
                <Route path="subscription-decrypt/:surveyId" element={<SubscriptionDecrypt />} />
                
                {/* Access Management */}
                <Route path="allowlist" element={<MyAllowlistAccess />} />
                <Route path="access-control" element={<MyAllowlistAccess />} />
                
                {/* Survey Details */}
                <Route path="survey/:surveyId" element={<ViewSurveyDetails />} />
              </Route>
              
              {/* Fallback redirect */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Router>
        </WalletProvider>
      </SuiClientProvider>
    </QueryClientProvider>
  );
}

export default App;