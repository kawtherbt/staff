const express = require('express');
const router = express.Router();
const {addStaff,addStaffWithAgence,updateStaff,deleteStaff,getAllStaff,getParticipation,getStaffEvents,getEventStaff,getAvailabeEventStaff,addStaffToEvent,removeStaffFromEvent,getAvailableStaff,getStaffByEvent,setStaffAvailable,getAllAgencies,
    getAgenceTableStructure,getStaffWithAgencyByEvent,deleteStaffAndAssignments} = require('../controllers/staffController');

router.post('/addStaff', addStaff);
router.post('/addStaffWithAgence', addStaffWithAgence);
router.put('/updateStaff', updateStaff);
router.delete('/deleteStaff', deleteStaff);
router.get('/getAllStaff', getAllStaff);
router.get('/getParticipation', getParticipation);
router.get('/getStaffEvents/:id', getStaffEvents);
router.get('/getEventStaff/:ID', getEventStaff);
router.get('/getAvailabeEventStaff/:start_date/:end_date', getAvailabeEventStaff);
router.post('/addStaffToEvent', addStaffToEvent);
router.delete('/removeStaffFromEvent/:ID_staff/:ID_event', removeStaffFromEvent);
router.get('/getAvailableStaff', getAvailableStaff);
router.get('/getStaffByEvent/:event_id', getStaffByEvent);
router.put('/setStaffAvailable', setStaffAvailable);
router.get('/getAllAgencies', getAllAgencies);
router.get('/getAgenceTableStructure', getAgenceTableStructure);
router.post('/getStaffWithAgencyByEvent', getStaffWithAgencyByEvent);
router.delete('/staff/deleteStaffAndAssignments', deleteStaffAndAssignments);

module.exports = router; 