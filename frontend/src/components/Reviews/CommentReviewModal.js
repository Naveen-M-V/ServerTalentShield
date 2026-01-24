import { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import axios from 'axios';

const API_BASE = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5003/api';

export default function CommentReviewModal({ isOpen, onClose, onSuccess, review }) {
    // Legacy review comment modal removed in favor of rebuilt Reviews page.
    return null;
}
