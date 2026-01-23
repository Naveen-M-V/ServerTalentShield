import { useState } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { goalsApi } from '../../utils/performanceApi';
import { toast } from 'react-toastify';
import ModernDatePicker from '../ModernDatePicker';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';

export default function CreateGoalDrawer({ isOpen, onClose, onSuccess, employees }) {
    const [formData, setFormData] = useState({
        goalName: '',
        description: '',
        assignee: '',
        startDate: '',
        dueDate: '',
        measurementType: 'Progress (%)',
    });
    const [loading, setLoading] = useState(false);
    const [errors, setErrors] = useState({});
// Legacy goal drawer removed in favor of new Goals page implementation.
export default function CreateGoalDrawer() {
  return null;
}
                                        checked={formData.measurementType === type}
                                        onChange={handleChange}
                                        className="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300"
                                    />
                                    <span className="ml-3 text-sm text-gray-700">{type}</span>
                                </label>
                            ))}
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-3 pt-4">
                        <button
                            type="button"
                            onClick={handleClose}
                            disabled={loading}
                            className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium disabled:opacity-50"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? 'Creating...' : 'Create Goal'}
                        </button>
                    </div>
                </form>
            </div>
        </>
    );
}
