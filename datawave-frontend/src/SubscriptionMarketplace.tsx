// src/pages/SubscriptionMarketplace.tsx
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  ShoppingBag, 
  Clock, 
  Users, 
  TrendingUp,
  Star,
  Lock,
  Unlock,
  Filter,
  Search
} from 'lucide-react';
import './SubscriptionMarketplace.css';

interface SubscriptionPackage {
  id: string;
  title: string;
  description: string;
  price: number;
  duration: string;
  features: string[];
  subscriberCount: number;
  rating: number;
  category: string;
  isPopular?: boolean;
  isSubscribed?: boolean;
}

const SubscriptionMarketplace: React.FC = () => {
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  const packages: SubscriptionPackage[] = [
    {
      id: '1',
      title: 'Consumer Insights Pro',
      description: 'Premium consumer behavior analytics and market trends',
      price: 500,
      duration: '30 days',
      features: [
        'Access to 1000+ survey responses',
        'Advanced demographic filtering',
        'Real-time data updates',
        'Export to CSV/Excel',
        'Priority support'
      ],
      subscriberCount: 234,
      rating: 4.8,
      category: 'Market Research',
      isPopular: true
    },
    {
      id: '2',
      title: 'Academic Research Bundle',
      description: 'Comprehensive data for academic studies and research papers',
      price: 200,
      duration: '90 days',
      features: [
        'Verified participant data',
        'Statistical analysis tools',
        'Citation-ready exports',
        'Collaboration features'
      ],
      subscriberCount: 156,
      rating: 4.6,
      category: 'Academic'
    },
    // Add more packages...
  ];

  const categories = ['all', 'Market Research', 'Academic', 'Product Development', 'UX Research'];

  return (
    <div className="subscription-marketplace">
      {/* Header */}
      <div className="marketplace-header">
        <div className="header-content">
          <h1>Data Subscription Marketplace</h1>
          <p>Access premium survey data and insights with blockchain-secured subscriptions</p>
        </div>
        
        <div className="header-stats">
          <div className="stat">
            <ShoppingBag size={20} />
            <span className="stat-value">250+</span>
            <span className="stat-label">Packages</span>
          </div>
          <div className="stat">
            <Users size={20} />
            <span className="stat-value">5.2k</span>
            <span className="stat-label">Subscribers</span>
          </div>
          <div className="stat">
            <TrendingUp size={20} />
            <span className="stat-value">98%</span>
            <span className="stat-label">Satisfaction</span>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="marketplace-filters">
        <div className="search-bar">
          <Search size={20} />
          <input 
            type="text"
            placeholder="Search subscriptions..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        
        <div className="category-filters">
          {categories.map(cat => (
            <button
              key={cat}
              className={`filter-btn ${selectedCategory === cat ? 'active' : ''}`}
              onClick={() => setSelectedCategory(cat)}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Subscription Grid */}
      <div className="packages-grid">
        {packages.map((pkg, index) => (
          <motion.div
            key={pkg.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className={`package-card ${pkg.isPopular ? 'popular' : ''}`}
          >
            {pkg.isPopular && (
              <div className="popular-badge">
                <Star size={14} />
                Most Popular
              </div>
            )}
            
            <div className="package-header">
              <h3>{pkg.title}</h3>
              <p className="package-description">{pkg.description}</p>
              <div className="package-meta">
                <span className="category-tag">{pkg.category}</span>
                <div className="rating">
                  <Star size={14} fill="currentColor" />
                  <span>{pkg.rating}</span>
                </div>
              </div>
            </div>
            
            <div className="package-price">
              <span className="price-value">{pkg.price} SUI</span>
              <span className="price-duration">/ {pkg.duration}</span>
            </div>
            
            <ul className="package-features">
              {pkg.features.map((feature, idx) => (
                <li key={idx}>
                  <Unlock size={14} />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
            
            <div className="package-footer">
              <div className="subscriber-count">
                <Users size={14} />
                <span>{pkg.subscriberCount} subscribers</span>
              </div>
              
              <button className={`subscribe-btn ${pkg.isSubscribed ? 'subscribed' : ''}`}>
                {pkg.isSubscribed ? (
                  <>
                    <Unlock size={16} />
                    Access Data
                  </>
                ) : (
                  <>
                    <Lock size={16} />
                    Subscribe Now
                  </>
                )}
              </button>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

export default SubscriptionMarketplace;