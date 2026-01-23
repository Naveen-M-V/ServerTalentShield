import React, { useState, useRef, useCallback } from "react";
import { ZoomIn, ZoomOut, Edit3, Printer, EyeOff, Eye, X, Plus, Save, RotateCcw, Trash2 } from "lucide-react";
import axios from "../utils/axiosConfig";

// Initial org data structure with branches and co-employees
const initialOrgData = {
  id: "root",
  name: "Your Company",
  role: "Company Root",
  initials: "YC",
  branches: ["Executive Leadership", "Corporate"],
  children: [
    {
      id: "ceo",
      name: "CEO",
      role: "Chief Executive Officer",
      initials: "CE",
      branches: ["Executive", "Strategy"],
      peers: [
        {
          id: "cfo",
          name: "CFO",
          role: "Chief Financial Officer",
          initials: "CF",
          branches: ["Finance", "Operations"]
        },
        {
          id: "cto",
          name: "CTO",
          role: "Chief Technology Officer",
          initials: "CT",
          branches: ["Technology", "Innovation"]
        }
      ],
      children: [
        {
          id: "eng-dept",
          name: "Engineering",
          role: "Engineering Department",
          initials: "EN",
          branches: ["Engineering Division", "Product Development"],
          children: []
        },
        {
          id: "sales-dept",
          name: "Sales",
          role: "Sales Department",
          initials: "SA",
          branches: ["Sales Division", "Revenue"],
          children: []
        }
      ]
    }
  ]
};

// Avatar component
function Avatar({ initials, size = "normal" }) {
  const sizeClasses = size === "small" ? "w-8 h-8 text-sm" : "w-12 h-12 md:w-16 md:h-16 text-xl md:text-2xl";
  return (
    <div className={`${sizeClasses} rounded-full bg-[#0056b3] flex items-center justify-center text-white font-bold border-4 border-white shadow-md`}>
      {initials}
    </div>
  );
}

// Node Card Component
function NodeCard({ node, onProfile, children, hideable, hidden, onToggle, onEdit, onDelete, onAdd, isEditable = false, isDragging = false }) {
  return (
    <div className="flex flex-col items-center">
      <div
        className={`bg-white rounded-xl shadow-lg hover:shadow-2xl transition-all duration-150 px-6 py-4 min-w-[210px] max-w-[240px] flex flex-col items-center border border-[#e7edf5] cursor-pointer relative ${isDragging ? 'opacity-50 scale-95' : ''
          } ${isEditable ? 'ring-2 ring-blue-400 ring-opacity-50' : ''}`}
        onClick={onProfile}
        style={{ zIndex: 2 }}
      >
        {isEditable && (
          <div className="absolute top-2 right-2 flex gap-1">
            <button
              className="w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center hover:bg-blue-600 transition-colors"
              onClick={(e) => { e.stopPropagation(); onEdit && onEdit(node); }}
              title="Edit"
            >
              <Edit3 className="w-3 h-3" />
            </button>
            <button
              className="w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-colors"
              onClick={(e) => { e.stopPropagation(); onDelete && onDelete(node); }}
              title="Delete"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        )}

        <Avatar initials={node.initials} />
        <div className="mt-3 text-lg font-bold text-gray-900 text-center leading-tight">{node.name}</div>
        <div className="text-sm text-gray-500 text-center mt-1">{node.role}</div>

        {hideable && (
          <button
            className="mt-3 text-[#0056b3] text-sm font-medium hover:underline focus:outline-none"
            onClick={e => { e.stopPropagation(); onToggle && onToggle(); }}
          >
            {hidden ? (
              <span className="inline-flex items-center"><Eye className="w-4 h-4 mr-1" /> Show employees</span>
            ) : (
              <span className="inline-flex items-center"><EyeOff className="w-4 h-4 mr-1" /> Hide employees</span>
            )}
          </button>
        )}

        {isEditable && !hideable && (
          <button
            className="mt-3 text-green-600 text-sm font-medium hover:underline focus:outline-none"
            onClick={e => { e.stopPropagation(); onAdd && onAdd(node); }}
          >
            <span className="inline-flex items-center"><Plus className="w-4 h-4 mr-1" /> Add employee</span>
          </button>
        )}
      </div>
      {children}
    </div>
  );
}

// Edit Form Modal
function EditNodeModal({ isOpen, onClose, node, onSave }) {
  const [formData, setFormData] = useState({
    name: node?.name || '',
    role: node?.role || '',
    initials: node?.initials || '',
    branches: node?.branches || []
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({ ...node, ...formData });
    onClose();
  };

  const handleBranchChange = (index, value) => {
    const newBranches = [...formData.branches];
    if (value) {
      newBranches[index] = value;
    } else {
      newBranches.splice(index, 1);
    }
    setFormData({ ...formData, branches: newBranches });
  };

  const addBranch = () => {
    setFormData({ ...formData, branches: [...formData.branches, ''] });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-2xl p-6 w-96 max-h-[80vh] overflow-y-auto">
        <h3 className="text-lg font-bold text-gray-900 mb-4">Edit {node?.type || 'Node'}</h3>
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
            <input
              type="text"
              value={formData.role}
              onChange={(e) => setFormData({ ...formData, role: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Initials</label>
            <input
              type="text"
              value={formData.initials}
              onChange={(e) => setFormData({ ...formData, initials: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              maxLength={3}
              required
            />
          </div>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Branches/Departments</label>
            {formData.branches.map((branch, index) => (
              <div key={index} className="flex gap-2 mb-2">
                <input
                  type="text"
                  value={branch}
                  onChange={(e) => handleBranchChange(index, e.target.value)}
                  placeholder="Enter branch name"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  type="button"
                  onClick={() => handleBranchChange(index, '')}
                  className="px-2 py-1 text-red-600 hover:bg-red-50 rounded"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={addBranch}
              className="mt-2 text-blue-600 text-sm font-medium hover:underline flex items-center"
            >
              <Plus className="w-4 h-4 mr-1" /> Add Branch
            </button>
          </div>
          <div className="flex gap-3 justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-[#e00070] text-white rounded-lg hover:bg-[#c00060]"
            >
              Save
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Tree Node Component (Recursive) - Enhanced with co-employees and branches
function TreeNode({ node, level = 0, isEditable = false, onEdit, onDelete, onAdd, onToggle, hiddenNodes, draggedNode, onDragStart, onDragOver, onDrop }) {
  const isHidden = hiddenNodes.includes(node.id);
  const hasChildren = node.children && node.children.length > 0;
  const hasPeers = node.peers && node.peers.length > 0;
  const hasBranches = node.branches && node.branches.length > 0;

  const handleDragStart = (e) => {
    if (isEditable) {
      onDragStart(e, node);
    }
  };

  const handleDragOver = (e) => {
    if (isEditable) {
      e.preventDefault();
      onDragOver(e, node);
    }
  };

  const handleDrop = (e) => {
    if (isEditable) {
      e.preventDefault();
      onDrop(e, node);
    }
  };

  return (
    <div className="flex flex-col items-center">
      {/* Branch/Department Labels */}
      {hasBranches && (
        <div className="mb-4 flex flex-wrap gap-2 justify-center">
          {node.branches.map((branch, index) => (
            <div
              key={index}
              className="px-3 py-1 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-full shadow-lg text-xs font-semibold"
            >
              {branch}
            </div>
          ))}
        </div>
      )}

      {/* Main node with peers (horizontal layout) */}
      <div className="flex items-center gap-6">
        {/* Left peers */}
        {hasPeers && node.peers.slice(0, Math.floor(node.peers.length / 2)).map((peer, index) => (
          <div key={`peer-left-${index}`} className="relative">
            {/* Horizontal connector to main node */}
            <div className="absolute top-1/2 -right-3 w-6 h-0.5 bg-blue-400 transform -translate-y-1/2"></div>
            <div
              draggable={isEditable}
              onDragStart={(e) => isEditable && onDragStart(e, peer)}
              onDragOver={(e) => isEditable && handleDragOver(e)}
              onDrop={(e) => isEditable && handleDrop(e)}
              className={`transition-all duration-200 ${isEditable ? 'cursor-move' : ''}`}
            >
              <NodeCard
                node={peer}
                isEditable={isEditable}
                onEdit={() => onEdit(peer)}
                onDelete={() => onDelete(peer)}
                onAdd={() => onAdd(peer)}
                isDragging={draggedNode?.id === peer.id}
              />
            </div>
          </div>
        ))}

        {/* Main node */}
        <div
          draggable={isEditable}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          className={`transition-all duration-200 ${isEditable ? 'cursor-move' : ''} ${hasPeers ? 'ring-2 ring-blue-300 ring-offset-2' : ''}`}
        >
          <NodeCard
            node={node}
            isEditable={isEditable}
            hideable={hasChildren}
            hidden={isHidden}
            onToggle={() => onToggle(node.id)}
            onEdit={() => onEdit(node)}
            onDelete={() => onDelete(node)}
            onAdd={() => onAdd(node)}
            isDragging={draggedNode?.id === node.id}
          />
        </div>

        {/* Right peers */}
        {hasPeers && node.peers.slice(Math.floor(node.peers.length / 2)).map((peer, index) => (
          <div key={`peer-right-${index}`} className="relative">
            {/* Horizontal connector to main node */}
            <div className="absolute top-1/2 -left-3 w-6 h-0.5 bg-blue-400 transform -translate-y-1/2"></div>
            <div
              draggable={isEditable}
              onDragStart={(e) => isEditable && onDragStart(e, peer)}
              onDragOver={(e) => isEditable && handleDragOver(e)}
              onDrop={(e) => isEditable && handleDrop(e)}
              className={`transition-all duration-200 ${isEditable ? 'cursor-move' : ''}`}
            >
              <NodeCard
                node={peer}
                isEditable={isEditable}
                onEdit={() => onEdit(peer)}
                onDelete={() => onDelete(peer)}
                onAdd={() => onAdd(peer)}
                isDragging={draggedNode?.id === peer.id}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Children (subordinates) */}
      {!isHidden && hasChildren && (
        <div className="relative">
          {/* Vertical connector */}
          <div className="w-0.5 h-8 bg-[#c9d4df] mx-auto"></div>

          {/* Horizontal connector and children */}
          <div className="flex gap-8 relative">
            {/* Horizontal line */}
            <div className="absolute top-0 left-1/2 w-full h-0.5 bg-[#c9d4df] transform -translate-x-1/2"></div>

            {node.children.map((child, index) => (
              <div key={child.id} className="relative">
                {/* Vertical connector to child */}
                <div className="absolute -top-8 left-1/2 w-0.5 h-8 bg-[#c9d4df] transform -translate-x-1/2"></div>
                <TreeNode
                  node={child}
                  level={level + 1}
                  isEditable={isEditable}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  onAdd={onAdd}
                  onToggle={onToggle}
                  hiddenNodes={hiddenNodes}
                  draggedNode={draggedNode}
                  onDragStart={onDragStart}
                  onDragOver={onDragOver}
                  onDrop={onDrop}
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Main Organisational Chart Component
function OrganisationalChart() {
  const [zoom, setZoom] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [isEditable, setIsEditable] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [orgData, setOrgData] = useState(initialOrgData);
  const [originalOrgData, setOriginalOrgData] = useState(initialOrgData);
  const [hiddenNodes, setHiddenNodes] = useState([]);
  const [draggedNode, setDraggedNode] = useState(null);
  const [editingNode, setEditingNode] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);

  // Load data from backend
  React.useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        // First, try to load custom org chart from localStorage
        const savedOrgChart = localStorage.getItem('customOrgChart');
        if (savedOrgChart) {
          const parsed = JSON.parse(savedOrgChart);
          setOrgData(parsed);
          setOriginalOrgData(parsed);
          setLoading(false);
          return;
        }

        // If no saved chart, load from backend
        const response = await axios.get("/api/employees/org-chart");
        if (response.data.success && response.data.data && response.data.data.length > 0) {
          // Use the first org chart from backend
          setOrgData(response.data.data[0]);
          setOriginalOrgData(response.data.data[0]);
        } else {
          // No org chart in backend, use initial data
          setOrgData(initialOrgData);
          setOriginalOrgData(initialOrgData);
        }
      } catch (err) {
        console.error("Failed to load org chart:", err);
        // Fallback to initial data if API fails
        setOrgData(initialOrgData);
        setOriginalOrgData(initialOrgData);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  // Edit mode toggle
  const handleEditToggle = () => {
    if (isEditable && hasChanges) {
      if (!window.confirm('You have unsaved changes. Are you sure you want to exit edit mode?')) {
        return;
      }
    }
    setIsEditable(!isEditable);
    if (!isEditable) {
      setOriginalOrgData(JSON.parse(JSON.stringify(orgData)));
    } else {
      setHasChanges(false);
    }
  };

  // Node editing
  const handleEditNode = (node) => {
    setEditingNode(node);
    setShowEditModal(true);
  };

  const handleSaveNode = (updatedNode) => {
    const updateNodeInTree = (tree, targetId, updatedData) => {
      if (tree.id === targetId) {
        return { ...tree, ...updatedData };
      }
      if (tree.children) {
        return {
          ...tree,
          children: tree.children.map(child => updateNodeInTree(child, targetId, updatedData))
        };
      }
      return tree;
    };

    setOrgData(updateNodeInTree(orgData, updatedNode.id, updatedNode));
    setHasChanges(true);
  };

  // Node deletion
  const handleDeleteNode = (node) => {
    if (!window.confirm(`Are you sure you want to delete ${node.name} and all its subordinates?`)) {
      return;
    }

    const deleteNodeFromTree = (tree, targetId) => {
      if (tree.id === targetId) {
        return null;
      }
      if (tree.children) {
        return {
          ...tree,
          children: tree.children.map(child => deleteNodeFromTree(child, targetId)).filter(Boolean)
        };
      }
      return tree;
    };

    const updatedData = deleteNodeFromTree(orgData, node.id);
    if (updatedData) {
      setOrgData(updatedData);
      setHasChanges(true);
    }
  };

  // Node addition
  const handleAddNode = (parentNode) => {
    const name = prompt(`Enter name for new employee under ${parentNode.name}:`);
    if (!name) return;

    const role = prompt(`Enter role for ${name}:`);
    if (!role) return;

    const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 3);

    // Ask if user wants to add branches
    const addBranches = window.confirm(`Would you like to add branches/departments for ${name}?`);
    let branches = [];
    
    if (addBranches) {
      const branchInput = prompt(`Enter branches/departments for ${name} (comma-separated):`);
      if (branchInput) {
        branches = branchInput.split(',').map(b => b.trim()).filter(b => b);
      }
    }

    const addNodeToTree = (tree, targetId, newNode) => {
      if (tree.id === targetId) {
        return {
          ...tree,
          children: [...(tree.children || []), { ...newNode, id: Date.now().toString(), children: [], branches }]
        };
      }
      if (tree.children) {
        return {
          ...tree,
          children: tree.children.map(child => addNodeToTree(child, targetId, newNode))
        };
      }
      return tree;
    };

    setOrgData(addNodeToTree(orgData, parentNode.id, { name, role, initials, branches }));
    setHasChanges(true);
  };

  // Toggle node visibility
  const handleToggleNode = (nodeId) => {
    setHiddenNodes(prev =>
      prev.includes(nodeId)
        ? prev.filter(id => id !== nodeId)
        : [...prev, nodeId]
    );
  };

  // Drag and drop handlers
  const handleDragStart = (e, node) => {
    setDraggedNode(node);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e, node) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e, targetNode) => {
    e.preventDefault();

    if (!draggedNode || draggedNode.id === targetNode.id) {
      setDraggedNode(null);
      return;
    }

    // Remove node from its current position
    const removeNodeFromTree = (tree, nodeId) => {
      if (tree.id === nodeId) {
        return null;
      }
      if (tree.children) {
        return {
          ...tree,
          children: tree.children.map(child => removeNodeFromTree(child, nodeId)).filter(Boolean)
        };
      }
      return tree;
    };

    // Add node to new position
    const addNodeToTree = (tree, targetId, nodeToAdd) => {
      if (tree.id === targetId) {
        return {
          ...tree,
          children: [...(tree.children || []), nodeToAdd]
        };
      }
      if (tree.children) {
        return {
          ...tree,
          children: tree.children.map(child => addNodeToTree(child, targetId, nodeToAdd))
        };
      }
      return tree;
    };

    let updatedData = removeNodeFromTree(orgData, draggedNode.id);
    updatedData = addNodeToTree(updatedData, targetNode.id, draggedNode);

    setOrgData(updatedData);
    setHasChanges(true);
    setDraggedNode(null);
  };

  // Save changes
  const handleSave = async () => {
    try {
      setLoading(true);

      // Extract manager relationships from org chart
      const managerRelationships = [];
      const extractRelationships = (node) => {
        if (node.children && node.children.length > 0) {
          node.children.forEach(child => {
            if (child._id && node._id) {
              managerRelationships.push({
                employeeId: child._id,
                managerId: node._id
              });
            }
            extractRelationships(child);
          });
        }
      };
      extractRelationships(orgData);

      // Save to database
      await axios.post('/api/employees/org-chart/save', {
        managerRelationships
      });

      // Store org chart in localStorage for visual persistence
      localStorage.setItem('customOrgChart', JSON.stringify(orgData));

      console.log('Org chart saved to database and localStorage');
      alert('Organizational chart saved successfully! Manager relationships have been updated in the database.');

      setOriginalOrgData(JSON.parse(JSON.stringify(orgData)));
      setHasChanges(false);
      setIsEditable(false);
    } catch (err) {
      console.error('Failed to save org chart:', err);
      setError(err.response?.data?.message || "Failed to save org chart");
      alert(err.response?.data?.message || 'Failed to save org chart. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Cancel changes
  const handleCancel = () => {
    setOrgData(JSON.parse(JSON.stringify(originalOrgData)));
    setHasChanges(false);
    setIsEditable(false);
  };

  // Print chart
  const handlePrint = () => {
    // Add print-specific class to body
    document.body.classList.add('printing-org-chart');

    // Add print styles dynamically
    const style = document.createElement('style');
    style.id = 'org-chart-print-styles';
    style.textContent = `
      @media print {
        body.printing-org-chart * {
          visibility: hidden;
        }
        body.printing-org-chart #org-chart-container,
        body.printing-org-chart #org-chart-container * {
          visibility: visible;
        }
        body.printing-org-chart #org-chart-container {
          position: absolute;
          left: 0;
          top: 0;
          width: 100%;
        }
        /* Hide control buttons when printing */
        body.printing-org-chart .no-print {
          display: none !important;
        }
      }
    `;
    document.head.appendChild(style);

    window.print();

    // Cleanup after print
    setTimeout(() => {
      document.body.classList.remove('printing-org-chart');
      const styleEl = document.getElementById('org-chart-print-styles');
      if (styleEl) styleEl.remove();
    }, 1000);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f6f8fa] p-8 flex items-center justify-center">
        <div className="text-lg text-gray-500">Loading org chart...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f6f8fa] p-8">
      {/* Header */}
      <div className="bg-white border border-[#e7edf5] rounded-lg px-8 py-6 flex flex-col md:flex-row md:items-center md:justify-between mb-6">
        <div>
          <div className="flex items-center gap-4 mb-2">
            <h1 className="text-2xl font-bold text-gray-900">Organisational chart</h1>
            <span className="bg-[#fbeaf3] text-[#e00070] text-xs font-bold px-3 py-1 rounded-full ml-2">Labs</span>
          </div>
          <div className="text-sm text-gray-500 max-w-xl">
            This is an experimental feature, please send us feedback to tell us what you love and what doesn't work for you.
          </div>
        </div>

        <div className="flex items-center gap-3 mt-4 md:mt-0">
          {isEditable ? (
            <>
              <button
                onClick={handleCancel}
                className="border-2 border-[#e00070] text-[#e00070] px-5 py-2 rounded-lg font-medium text-sm hover:bg-[#fbeaf3] transition-colors flex items-center"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="bg-[#e00070] text-white px-5 py-2 rounded-lg font-medium text-sm hover:bg-[#c00060] transition-colors flex items-center disabled:opacity-50"
                disabled={!hasChanges}
              >
                <Save className="w-4 h-4 mr-2" /> Save
              </button>
            </>
          ) : (
            <button
              className="border-2 border-[#e00070] text-[#e00070] px-5 py-2 rounded-lg font-medium text-sm hover:bg-[#fbeaf3] transition-colors flex items-center"
              onClick={handleEditToggle}
            >
              <Edit3 className="w-4 h-4 mr-2" /> Edit
            </button>
          )}

          <button className="bg-[#e00070] text-white px-5 py-2 rounded-lg font-medium text-sm hover:bg-[#c00060] transition-colors flex items-center">
            Unpublish
          </button>
          <button
            onClick={handlePrint}
            className="border-2 border-[#e00070] text-[#e00070] px-5 py-2 rounded-lg font-medium text-sm hover:bg-[#fbeaf3] transition-colors flex items-center"
          >
            <Printer className="w-4 h-4 mr-2" /> Print chart
          </button>
          <button className="ml-2" onClick={() => setZoom(z => Math.max(0.5, z - 0.1))}>
            <ZoomOut className="w-6 h-6 text-[#0056b3]" />
          </button>
          <button onClick={() => setZoom(z => Math.min(2, z + 0.1))}>
            <ZoomIn className="w-6 h-6 text-[#0056b3]" />
          </button>
        </div>
      </div>

      {/* Chart Canvas */}
      <div id="org-chart-container" className="relative bg-white border border-[#e7edf5] rounded-lg p-12 overflow-auto" style={{ minHeight: 700, minWidth: 900, maxHeight: '75vh' }}>
        {error ? (
          <div className="flex items-center justify-center h-full text-lg text-red-500">{error}</div>
        ) : (
          <div
            className="flex justify-center transition-transform duration-200"
            style={{ transform: `scale(${zoom})`, transformOrigin: 'top center' }}
          >
            <TreeNode
              node={orgData}
              isEditable={isEditable}
              onEdit={handleEditNode}
              onDelete={handleDeleteNode}
              onAdd={handleAddNode}
              onToggle={handleToggleNode}
              hiddenNodes={hiddenNodes}
              draggedNode={draggedNode}
              onDragStart={handleDragStart}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
            />
          </div>
        )}
      </div>

      {/* Edit Modal */}
      <EditNodeModal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        node={editingNode}
        onSave={handleSaveNode}
      />
    </div>
  );
}

export default OrganisationalChart;
