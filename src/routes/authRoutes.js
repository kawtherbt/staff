const express = require('express');
const auth = require('../middlewares/authMiddleware');

const {signUp, logIn, updateAccount, deleteAccount,
     getAcounts} = require('../controllers/authController');

const router = express.Router();

router.post('/signUp',auth,signUp);
router.post('/logIn',logIn);

router.put('/updateAccount',auth,updateAccount);

router.get('/getAcounts',getAcounts);

router.delete('/deleteAccount',auth,deleteAccount);

module.exports = router;