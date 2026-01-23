const express = require('express');
const router = express.Router();
const teamController = require('../controllers/teamController');

// Team CRUD operations
router.get('/', teamController.getAllTeams);
router.get('/:id', teamController.getTeamById);
router.post('/', teamController.createTeam);
router.put('/:id', teamController.updateTeam);
router.delete('/:id', teamController.deleteTeam);

// Team member management
router.post('/:id/members/add', teamController.addMemberToTeam);
router.post('/:id/members/remove', teamController.removeMemberFromTeam);

module.exports = router;
