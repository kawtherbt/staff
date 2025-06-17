const pool = require("../../db/dbConnection");
const jwt = require('jsonwebtoken');
const {z} = require("zod");

const addTeam = async (req, res) => {
  try {
    const teamSchema = z.object({
      nom: z.string().trim().min(1, { message: "Nom is required" }),
    });

    const result = teamSchema.safeParse(req.body);

    if (!result.success) {
      console.log('Validation errors:', result.error.errors);
      return res.status(400).json({ errors: result.error.errors });
    }

    const decoded_token = req.decoded_token;
    const { nom } = result.data;

    console.log('Decoded token:', decoded_token);
    if (!decoded_token || !decoded_token.id) {
      console.log('Missing or invalid decoded token');
      return res.status(400).json({ success: false, message: "Missing or invalid token data" });
    }

    // Vérifier si l'utilisateur existe et récupérer entreprise_id
    const checkQuery = 'SELECT entreprise_id FROM accounts WHERE "ID" = $1';
    const checkResult = await pool.query(checkQuery, [decoded_token.id]);
    console.log('Entreprise query result:', checkResult.rows);

    if (checkResult.rowCount === 0) {
      return res.status(404).json({ success: false, message: "Account not found" });
    }

    const entreprise_id = checkResult.rows[0].entreprise_id;
    if (!entreprise_id) {
      return res.status(400).json({ success: false, message: "Entreprise ID not found for this account" });
    }

    const insertQuery = 'INSERT INTO team (nom, entreprise_id) VALUES ($1, $2)';
    const insertValues = [nom, entreprise_id];

    const insertResult = await pool.query(insertQuery, insertValues);
    console.log('Insert result:', insertResult);

    if (insertResult.rowCount === 0) {
      return res.status(404).json({ success: false, message: "No team was added" });
    }

    return res.status(200).json({ success: true, message: "Team added successfully" });
  } catch (error) {
    console.error('Error in addTeam:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

const updateTeam = async (req,res)=>{
    try {
        const teamSchema = z.object({
            nom: z.string().trim().min(1, { message: "Nom is required" }),
            ID: z.number().int(),
        });

        const result = teamSchema.safeParse(req.body);

        if (!result.success) {
            return res.status(400).json({ errors: result.error.errors });
        }
        
        const {nom,ID} = req.body;

        const query = `UPDATE team SET nom = $1 WHERE "ID"=$2 `;
        const values = [nom,ID]

        await pool.query(query,values);

        return res.status(200).json({success : true, message: "staff updated with success"});
    } catch (error) {
        return res.status(500).json({success:false,message:error.message});
    }
}

const deleteTeam = async(req,res)=>{
    try {
        const teamSchema = z.object({
            IDs: z.array(z.number().int()).min(1),
        });

        const result = teamSchema.safeParse(req.body);

        if (!result.success) {
            return res.status(400).json({ errors: result.error.errors });
        }

        const {IDs} = result.data;

        const query = 'DELETE FROM team WHERE "ID"= ANY($1)';
        const values = [IDs];

        await pool.query(query,values);
        return res.status(200).json({success: true, message : "teams deleted with success"});
    } catch (error) {
        return res.status(500).json({success:false,message:error.message});
    }
}

const getAllTeams = async (req,res)=>{
    try {
        const decoded_token = req.decoded_token;

        if(!decoded_token){
            return res.status(400).json({success:false,message:"missing data"});
        }

        const query = 'SELECT * FROM team WHERE entreprise_id=(SELECT entreprise_id FROM accounts WHERE "ID" = $1)';
        const values = [decoded_token.id];

        const data = await pool.query(query,values);
        if(!data){
            return res.status(400).json({"success":false , message:"failure"});
        }
        return res.status(201).json({success: true, message : "teams fetched with success",data:data.rows});
    } catch (error) {
        return res.status(500).json({success:false,message:error.message});
    }
}

const getAllStaffForTeams = async(req,res)=>{
    try {
        const decoded_token = req.decoded_token;

        if(!decoded_token){
            return res.status(400).json({success:false,message:"missing data"});
        }
        //old query: const query = 'SELECT * FROM staff WHERE team_id IS NOT NULL AND account_id IN (SELECT "ID" FROM accounts WHERE entreprise_id=(SELECT entreprise_id FROM accounts WHERE "ID" = $1))';
        const query = 'SELECT * FROM staff WHERE entreprise_id=(SELECT entreprise_id FROM accounts WHERE "ID" = $1)';
        const values = [decoded_token.id];

        const data = await pool.query(query,values);
        if(!data){
            return res.status(400).json({"success":false , message:"failure"});
        }
        return res.status(201).json({success: true, message : "staff fetched with success",data:data.rows});
    } catch (error) {
        return res.status(500).json({success:false,message:error.message});
    }
}

const addStaffToTeam = async (req,res)=>{
    try {
        const teamSchema = z.object({
            staffIds: z.array(z.number().int()).min(1),
            teamId : z.number().int(),
        });

        const result = teamSchema.safeParse(req.body);

        if (!result.success) {
            return res.status(400).json({ errors: result.error.errors });
        }


        let {staffIds,teamId} = result.data;
        if(teamId === 0){
            teamId = null;
        }
        //teamId === 0 ? null:teamId;
        const decoded_token = req.decoded_token ;
        

        if(!decoded_token){
            return res.status(400).json({success:false,message:"missing data"});
        }

        const query = 'UPDATE staff SET team_id = $1 WHERE "ID" = ANY($2) ';
        const values = [teamId,staffIds];

        const {rowCount} = await pool.query(query,values);

        if(rowCount === 0){
            return res.status(404).json({success : flase, message: "no staff were added"});
        }

        return res.status(200).json({success : true, message: "staff added with success"});
    } catch (error) {
        return res.status(500).json({success:false,message:error.message});
    }
}



module.exports = {addTeam,updateTeam,deleteTeam,getAllTeams,getAllStaffForTeams,addStaffToTeam}