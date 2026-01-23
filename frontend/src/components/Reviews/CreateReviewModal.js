import { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import axios from 'axios';

const API_BASE = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5003/api';

export default function CreateReviewModal({ isOpen, onClose, onSuccess, editingReview }) {
    const [loading, setLoading] = useState(false);
    const [employees, setEmployees] = useState([]);
    const [formData, setFormData] = useState({
        employeeId: '',
        reviewType: 'AD_HOC',
        // Legacy review modal removed in favor of rebuilt Reviews page.
        export default function CreateReviewModal() {
          return null;
        }
                                            name="reviewPeriodEnd"
                                            value={formData.reviewPeriodEnd}
                                            onChange={handleChange}
                                            className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500"
                                        />
                                    </div>
                                </div>

                                {/* Performance Summary */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Performance Summary
                                    </label>
                                    <textarea
                                        name="performanceSummary"
                                        value={formData.performanceSummary}
                                        onChange={handleChange}
                                        rows={5}
                                        maxLength={5000}
                                        placeholder="Summarize the employee's overall performance..."
                                        className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500"
                                    />
                                    <p className="mt-1 text-xs text-gray-500">
                                        {formData.performanceSummary.length}/5000 characters
                                    </p>
                                </div>

                                {/* Strengths */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Strengths
                                    </label>
                                    <textarea
                                        name="strengths"
                                        value={formData.strengths}
                                        onChange={handleChange}
                                        rows={3}
                                        maxLength={2000}
                                        placeholder="Key strengths and positive contributions..."
                                        className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500"
                                    />
                                    <p className="mt-1 text-xs text-gray-500">
                                        {formData.strengths.length}/2000 characters
                                    </p>
                                </div>

                                {/* Areas for Improvement */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Areas for Improvement
                                    </label>
                                    <textarea
                                        name="improvements"
                                        value={formData.improvements}
                                        onChange={handleChange}
                                        rows={3}
                                        maxLength={2000}
                                        placeholder="Areas where the employee can improve..."
                                        className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500"
                                    />
                                    <p className="mt-1 text-xs text-gray-500">
                                        {formData.improvements.length}/2000 characters
                                    </p>
                                </div>

                                {/* Rating */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Overall Rating (1-5)
                                    </label>
                                    <select
                                        name="rating"
                                        value={formData.rating}
                                        onChange={handleChange}
                                        className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500"
                                    >
                                        <option value="">No rating</option>
                                        <option value="1">1 - Needs Significant Improvement</option>
                                        <option value="2">2 - Below Expectations</option>
                                        <option value="3">3 - Meets Expectations</option>
                                        <option value="4">4 - Exceeds Expectations</option>
                                        <option value="5">5 - Outstanding</option>
                                    </select>
                                </div>

                                {/* Info Box */}
                                <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
                                    <div className="flex">
                                        <svg className="h-5 w-5 text-blue-400 mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                                        </svg>
                                        <div className="text-sm text-blue-700">
                                            <p className="font-medium mb-1">Review Lifecycle:</p>
                                            <ul className="list-disc list-inside space-y-1 text-xs">
                                                <li><strong>DRAFT:</strong> You can save and edit the review. Not visible to employee.</li>
                                                <li><strong>SUBMIT:</strong> Makes the review visible to employee. Cannot edit after submission.</li>
                                                <li><strong>COMPLETE:</strong> Marks review as final and creates a permanent, immutable record.</li>
                                            </ul>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="bg-gray-50 px-6 py-4 flex items-center justify-end space-x-3 border-t border-gray-200">
                            <button
                                type="button"
                                onClick={onClose}
                                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                                disabled={loading}
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                className="px-4 py-2 text-sm font-medium text-white bg-green-600 border border-transparent rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
                                disabled={loading}
                            >
                                {loading ? 'Saving...' : editingReview ? 'Update Review' : 'Create Review'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}
