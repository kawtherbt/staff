const express = require("express");

const {addTeam,updateTeam,deleteTeam,getAllTeams,
    getAllStaffForTeams,addStaffToTeam} = require("../controllers/team/teamController");

const router = express.Router();

router.post("/addTeam",addTeam);

router.put("/addStaffToTeam",addStaffToTeam);
router.put("/updateTeam",updateTeam);

router.delete("/deleteTeam",deleteTeam);

router.get("/getAllTeams",getAllTeams)
router.get("/getAllStaffForTeams",getAllStaffForTeams)

module.exports = router;