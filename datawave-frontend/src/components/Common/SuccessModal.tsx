// src/components/Common/SuccessModal.tsx
import { useEffect, useState } from 'react';
import { Check, ExternalLink, Copy, ArrowRight } from 'lucide-react';
import '../../css/SuccessModal.css';

interface SuccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  surveyId: string;
  title: string;
  txDigest: string;
  totalCost: number;
  onViewDetails: () => void;
  onViewList: () => void;
}

export function SuccessModal({
  isOpen,
  surveyId,
  title,
  txDigest,
  totalCost,
  onViewDetails,
  onViewList
}: SuccessModalProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [canProceed, setCanProceed] = useState(false);
  
  useEffect(() => {
    if (isOpen) {
      setIsLoading(true);
      setCanProceed(false);
      
      // 模拟链上同步延迟
      const timer = setTimeout(() => {
        setIsLoading(false);
        setCanProceed(true);
      }, 3000);
      
      return () => clearTimeout(timer);
    }
  }, [isOpen]);
  
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  
  const formatAddress = (address: string) => {
    return `${address.slice(0, 8)}...${address.slice(-6)}`;
  };
  
  if (!isOpen) return null;
  
  return (
    <div className="success-modal-overlay">
      <div className="success-modal">
        {/* Success Icon with animation */}
        <div className="success-modal-icon">
          <Check />
        </div>
        
        {/* Confetti effect */}
        <div className="success-confetti">
          {[...Array(12)].map((_, i) => (
            <div
              key={i}
              className="confetti-piece"
              style={{
                left: `${Math.random() * 100 - 50}px`,
                animationDelay: `${Math.random() * 0.5}s`,
                transform: `rotate(${Math.random() * 360}deg)`
              }}
            />
          ))}
        </div>
        
        <h2 className="success-modal-title">Survey Created Successfully!</h2>
        <p className="success-modal-message">
          Your survey "{title}" has been created and is now live on the blockchain.
        </p>
        
        {/* Details */}
        <div className="success-modal-details">
          <div className="success-modal-detail-item">
            <span className="success-modal-detail-label">Survey ID:</span>
            <span className="success-modal-detail-value">
              {formatAddress(surveyId)}
              <button
                onClick={() => copyToClipboard(surveyId)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#a78bfa',
                  cursor: 'pointer',
                  marginLeft: '8px'
                }}
              >
                <Copy size={14} />
              </button>
            </span>
          </div>
          
          <div className="success-modal-detail-item">
            <span className="success-modal-detail-label">Total Cost:</span>
            <span className="success-modal-detail-value">{totalCost.toFixed(3)} SUI</span>
          </div>
          
          <div className="success-modal-detail-item">
            <span className="success-modal-detail-label">Transaction:</span>
            <span className="success-modal-detail-value">
              {formatAddress(txDigest)}
              <a
                href={`https://suiscan.xyz/testnet/tx/${txDigest}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  color: '#a78bfa',
                  marginLeft: '8px'
                }}
              >
                <ExternalLink size={14} />
              </a>
            </span>
          </div>
        </div>
        
        {/* Loading indicator */}
        {isLoading && (
          <div className="success-modal-loading">
            <div className="success-modal-spinner"></div>
            <span className="success-modal-loading-text">
              Syncing with blockchain...
            </span>
            <div className="success-modal-progress">
              <div className="success-modal-progress-bar"></div>
            </div>
          </div>
        )}
        
        {copied && (
          <div style={{
            position: 'absolute',
            top: '20px',
            right: '20px',
            background: 'rgba(16, 185, 129, 0.9)',
            color: 'white',
            padding: '8px 16px',
            borderRadius: '8px',
            fontSize: '14px',
            animation: 'fadeIn 0.3s ease'
          }}>
            Copied!
          </div>
        )}
        
        {/* Actions */}
        <div className="success-modal-actions">
          <button
            className="success-modal-btn primary"
            onClick={onViewDetails}
            disabled={!canProceed}
          >
            View Survey Details
            <ArrowRight size={16} />
          </button>
          
          <button
            className="success-modal-btn secondary"
            onClick={onViewList}
            disabled={!canProceed}
          >
            Go to My Surveys
          </button>
        </div>
      </div>
    </div>
  );
}

export default SuccessModal;