import { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import axios from 'axios';

const API_BASE = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5003/api';

export default function CommentReviewModal({ isOpen, onClose, onSuccess, review }) {
    const [loading, setLoading] = useState(false);
    const [comment, setComment] = useState('');
    const [acknowledged, setAcknowledged] = useState(false);

    // Populate existing comment if available
    useEffect(() => {
        if (review && review.myComment) {
            setComment(review.myComment.comment || '');
            setAcknowledged(review.myComment.acknowledged || false);
        } else {
            setComment('');
            setAcknowledged(false);
        }
    }, [review]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        if (!comment.trim()) {
            toast.error('Please enter a comment');
            return;
        }

        if (comment.length > 2000) {
            toast.error('Comment cannot exceed 2000 characters');
            return;
        }

        // Legacy review comment modal removed in favor of rebuilt Reviews page.
        export default function CommentReviewModal() {
          return null;
        }
                                    <p className="mt-1 text-xs text-gray-500">
                                        {comment.length}/2000 characters
                                    </p>
                                </div>

                                {/* Acknowledgement Checkbox */}
                                <div className="flex items-start">
                                    <div className="flex items-center h-5">
                                        <input
                                            type="checkbox"
                                            checked={acknowledged}
                                            onChange={(e) => setAcknowledged(e.target.checked)}
                                            className="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded"
                                        />
                                    </div>
                                    <div className="ml-3">
                                        <label className="text-sm text-gray-700">
                                            I acknowledge that I have read and understood this performance review
                                        </label>
                                    </div>
                                </div>

                                {/* Info Box */}
                                <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
                                    <div className="flex">
                                        <svg className="h-5 w-5 text-blue-400 mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                                        </svg>
                                        <div className="text-sm text-blue-700">
                                            <p className="font-medium mb-1">About Your Feedback</p>
                                            <ul className="list-disc list-inside space-y-1 text-xs">
                                                <li>Your comment will be visible to your manager and HR</li>
                                                <li>You can update your comment at any time</li>
                                                <li>Your feedback becomes part of the permanent review record</li>
                                                <li>You cannot edit the performance feedback written by management</li>
                                            </ul>
                                        </div>
                                    </div>
                                </div>

                                {review.myComment && (
                                    <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3">
                                        <div className="flex">
                                            <svg className="h-5 w-5 text-yellow-400 mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                            </svg>
                                            <p className="text-sm text-yellow-700">
                                                You already have a comment on this review. Submitting this form will update your previous comment.
                                            </p>
                                        </div>
                                    </div>
                                )}
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
                                {loading ? 'Saving...' : review.myComment ? 'Update Comment' : 'Add Comment'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}
