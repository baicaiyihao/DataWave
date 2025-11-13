// Dashboard Page - Overview with Stats and Charts
import React, { useState, useEffect } from 'react';
import { Card, Flex, Text, Badge, Button, Grid } from '@radix-ui/themes';
import { useCurrentAccount } from '@mysten/dapp-kit';
import { useNavigate } from 'react-router-dom';
import { 
  TrendingUp, 
  Users, 
  DollarSign, 
  FileText, 
  ArrowUp,
  ArrowDown,
  Activity,
  Award,
  Target,
  Clock
} from 'lucide-react';
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';

interface StatCard {
  title: string;
  value: string | number;
  change: number;
  icon: React.ReactNode;
  color: 'green' | 'blue' | 'purple' | 'orange';
}

const Dashboard: React.FC = () => {
  const currentAccount = useCurrentAccount();
  const navigate = useNavigate();
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d'>('7d');
  const [loading, setLoading] = useState(true);

  // Mock data - Replace with real data from your services
  const stats: StatCard[] = [
    {
      title: 'Total Earnings',
      value: '1,234.56 SUI',
      change: 12.5,
      icon: <DollarSign size={20} />,
      color: 'green'
    },
    {
      title: 'Surveys Answered',
      value: 42,
      change: 8.2,
      icon: <FileText size={20} />,
      color: 'blue'
    },
    {
      title: 'Active Surveys',
      value: 15,
      change: -2.4,
      icon: <Activity size={20} />,
      color: 'purple'
    },
    {
      title: 'Success Rate',
      value: '94.2%',
      change: 3.1,
      icon: <Award size={20} />,
      color: 'orange'
    }
  ];

  // Chart data
  const earningsData = [
    { date: 'Mon', earnings: 120, responses: 5 },
    { date: 'Tue', earnings: 180, responses: 8 },
    { date: 'Wed', earnings: 150, responses: 6 },
    { date: 'Thu', earnings: 220, responses: 10 },
    { date: 'Fri', earnings: 280, responses: 12 },
    { date: 'Sat', earnings: 190, responses: 7 },
    { date: 'Sun', earnings: 240, responses: 9 },
  ];

  const categoryData = [
    { name: 'Market Research', value: 35, color: '#3B82F6' },
    { name: 'Product Feedback', value: 28, color: '#8B5CF6' },
    { name: 'User Experience', value: 20, color: '#10B981' },
    { name: 'Academic', value: 17, color: '#F59E0B' },
  ];

  const recentActivity = [
    {
      id: 1,
      type: 'survey_completed',
      title: 'Completed "Consumer Preferences Survey"',
      reward: '25 SUI',
      time: '2 hours ago',
      icon: <FileText size={16} />
    },
    {
      id: 2,
      type: 'subscription_purchased',
      title: 'Subscribed to "Market Insights Q4"',
      price: '100 SUI',
      time: '5 hours ago',
      icon: <DollarSign size={16} />
    },
    {
      id: 3,
      type: 'allowlist_added',
      title: 'Added to "Premium Research Panel"',
      by: '0x1234...5678',
      time: '1 day ago',
      icon: <Users size={16} />
    },
  ];

  useEffect(() => {
    // Simulate loading
    setTimeout(() => setLoading(false), 1000);
  }, []);

  // Navigation functions
  const navigateTo = (path: string) => {
    navigate(path);
  };

  return (
    <Flex direction="column" gap="4">
      {/* Header */}
      <Card>
        <Flex justify="between" align="center">
          <div>
            <Text size="6" weight="bold">Dashboard</Text>
            <Text size="2" color="gray">
              Welcome back, {currentAccount?.address?.slice(0, 8)}...
            </Text>
          </div>
          
          <Flex gap="2">
            <Button 
              variant={timeRange === '7d' ? 'solid' : 'soft'}
              onClick={() => setTimeRange('7d')}
            >
              7 Days
            </Button>
            <Button 
              variant={timeRange === '30d' ? 'solid' : 'soft'}
              onClick={() => setTimeRange('30d')}
            >
              30 Days
            </Button>
            <Button 
              variant={timeRange === '90d' ? 'solid' : 'soft'}
              onClick={() => setTimeRange('90d')}
            >
              90 Days
            </Button>
          </Flex>
        </Flex>
      </Card>

      {/* Stats Grid */}
      <Grid columns="4" gap="3">
        {stats.map((stat, index) => (
          <Card key={index} style={{ backgroundColor: `var(--${stat.color}-2)` }}>
            <Flex direction="column" gap="2">
              <Flex justify="between" align="center">
                <Badge color={stat.color} size="3" radius="full">
                  {stat.icon}
                </Badge>
                <Badge 
                  color={stat.change > 0 ? 'green' : 'red'} 
                  variant="soft"
                >
                  {stat.change > 0 ? <ArrowUp size={14} /> : <ArrowDown size={14} />}
                  {Math.abs(stat.change)}%
                </Badge>
              </Flex>
              <Text size="6" weight="bold">{stat.value}</Text>
              <Text size="2" color="gray">{stat.title}</Text>
            </Flex>
          </Card>
        ))}
      </Grid>

      {/* Charts Row */}
      <Grid columns="2" gap="3">
        {/* Earnings Chart */}
        <Card>
          <Flex direction="column" gap="3">
            <div>
              <Text size="4" weight="bold">Earnings & Activity</Text>
              <Text size="2" color="gray">Daily performance</Text>
            </div>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={earningsData}>
                <defs>
                  <linearGradient id="colorEarnings" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#3B82F6" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorResponses" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10B981" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--gray-6)" />
                <XAxis dataKey="date" stroke="var(--gray-9)" />
                <YAxis stroke="var(--gray-9)" />
                <Tooltip 
                  contentStyle={{ 
                    background: 'var(--gray-2)', 
                    border: '1px solid var(--gray-6)',
                    borderRadius: '8px'
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="earnings"
                  stroke="#3B82F6"
                  fillOpacity={1}
                  fill="url(#colorEarnings)"
                  strokeWidth={2}
                />
                <Area
                  type="monotone"
                  dataKey="responses"
                  stroke="#10B981"
                  fillOpacity={1}
                  fill="url(#colorResponses)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </Flex>
        </Card>

        {/* Category Distribution */}
        <Card>
          <Flex direction="column" gap="3">
            <div>
              <Text size="4" weight="bold">Survey Categories</Text>
              <Text size="2" color="gray">Distribution by type</Text>
            </div>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={categoryData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {categoryData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ 
                    background: 'var(--gray-2)', 
                    border: '1px solid var(--gray-6)',
                    borderRadius: '8px'
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </Flex>
        </Card>
      </Grid>

      {/* Recent Activity */}
      <Card>
        <Flex direction="column" gap="3">
          <Flex justify="between" align="center">
            <Text size="4" weight="bold">Recent Activity</Text>
            <Button variant="soft" size="2">View All</Button>
          </Flex>
          
          <Flex direction="column" gap="2">
            {recentActivity.map((activity) => (
              <Card key={activity.id} style={{ backgroundColor: 'var(--gray-1)' }}>
                <Flex align="center" gap="3">
                  <Badge 
                    size="3" 
                    color={
                      activity.type === 'survey_completed' ? 'green' : 
                      activity.type === 'subscription_purchased' ? 'blue' : 'purple'
                    }
                    radius="full"
                  >
                    {activity.icon}
                  </Badge>
                  <Flex direction="column" gap="1" style={{ flex: 1 }}>
                    <Text size="2" weight="medium">{activity.title}</Text>
                    <Flex gap="2" align="center">
                      {activity.reward && (
                        <Badge color="green" variant="soft">{activity.reward}</Badge>
                      )}
                      {activity.price && (
                        <Badge color="blue" variant="soft">{activity.price}</Badge>
                      )}
                      {activity.by && (
                        <Text size="1" color="gray">by {activity.by}</Text>
                      )}
                      <Flex align="center" gap="1">
                        <Clock size={12} />
                        <Text size="1" color="gray">{activity.time}</Text>
                      </Flex>
                    </Flex>
                  </Flex>
                </Flex>
              </Card>
            ))}
          </Flex>
        </Flex>
      </Card>

      {/* Quick Actions */}
      <Card>
        <Flex direction="column" gap="3">
          <Text size="4" weight="bold">Quick Actions</Text>
          <Grid columns="4" gap="3">
            <Button 
              size="3" 
              onClick={() => navigateTo('/marketplace')}
            >
              <FileText size={20} />
              Browse Surveys
            </Button>
            <Button 
              size="3" 
              variant="soft"
              onClick={() => navigateTo('/enterprise/create')}
            >
              <Target size={20} />
              Create Survey
            </Button>
            <Button 
              size="3" 
              variant="soft"
              color="green"
              onClick={() => navigateTo('/my-answers')}
            >
              <DollarSign size={20} />
              View Earnings
            </Button>
            <Button 
              size="3" 
              variant="soft"
              color="purple"
              onClick={() => navigateTo('/my-allowlist')}
            >
              <Users size={20} />
              Manage Access
            </Button>
          </Grid>
        </Flex>
      </Card>
    </Flex>
  );
};

export default Dashboard;