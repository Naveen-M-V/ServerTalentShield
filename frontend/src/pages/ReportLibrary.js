import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Calendar, Clock, UserX, TrendingUp, CalendarDays, Activity,
  Users, AlertTriangle, Receipt, Award, TrendingDown, BarChart,
  ShieldAlert, Pause, Search, Filter
} from 'lucide-react';
import axios from 'axios';
import ReportCard from '../components/Reports/ReportCard';
import ReportGenerationPanel from '../components/Reports/ReportGenerationPanel';

const ReportLibrary = () => {
  const [reports, setReports] = useState([]);
  const [filteredReports, setFilteredReports] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedReport, setSelectedReport] = useState(null);
  const [showGenerationPanel, setShowGenerationPanel] = useState(false);
  const [loading, setLoading] = useState(true);

  const iconMap = {
    Calendar, Clock, UserX, TrendingUp, CalendarDays, Activity,
    Users, AlertTriangle, Receipt, Award, TrendingDown, BarChart,
    ShieldAlert, Pause
  };

  useEffect(() => {
    fetchReportTypes();
  }, []);

  useEffect(() => {
    filterReports();
  }, [searchQuery, selectedCategory, reports]);

  const fetchReportTypes = async () => {
    try {
      const response = await axios.get('/api/report-library/types');
      if (response.data.success) {
        setReports(response.data.data);
        setFilteredReports(response.data.data);
      }
    } catch (error) {
      console.error('Error fetching report types:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterReports = () => {
    let filtered = [...reports];

    // Filter by category
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(report => report.category === selectedCategory);
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(report =>
        report.name.toLowerCase().includes(query) ||
        report.description.toLowerCase().includes(query)
      );
    }

    setFilteredReports(filtered);
  };

  const handleReportClick = (report) => {
    setSelectedReport(report);
    setShowGenerationPanel(true);
  };

  const handleClosePanel = () => {
    setShowGenerationPanel(false);
    setSelectedReport(null);
  };

  const categories = [
    { id: 'all', label: 'All Reports' },
    { id: 'Leave', label: 'Leave' },
    { id: 'Time', label: 'Time' },
    { id: 'People', label: 'People' },
    { id: 'Finance', label: 'Finance' },
    { id: 'Payroll', label: 'Payroll' },
    { id: 'Compliance', label: 'Compliance' }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Report Library</h1>
          <p className="text-gray-600">
            Generate comprehensive reports for workforce analytics and compliance
          </p>
        </motion.div>

        {/* Search and Filter Bar */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-6 flex flex-col md:flex-row gap-4"
        >
          {/* Search */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Search reports..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Category Filter */}
          <div className="flex items-center gap-2">
            <Filter size={20} className="text-gray-500" />
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              {categories.map(cat => (
                <option key={cat.id} value={cat.id}>
                  {cat.label}
                </option>
              ))}
            </select>
          </div>
        </motion.div>

        {/* Report Cards Grid */}
        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : filteredReports.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-16"
          >
            <p className="text-gray-500 text-lg">No reports found matching your criteria</p>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
          >
            {filteredReports.map((report, index) => (
              <ReportCard
                key={report.id}
                report={report}
                icon={iconMap[report.icon]}
                onClick={handleReportClick}
                delay={index * 0.05}
              />
            ))}
          </motion.div>
        )}

        {/* Report Generation Panel */}
        {showGenerationPanel && selectedReport && (
          <ReportGenerationPanel
            report={selectedReport}
            icon={iconMap[selectedReport.icon]}
            onClose={handleClosePanel}
          />
        )}
      </div>
    </div>
  );
};

export default ReportLibrary;
