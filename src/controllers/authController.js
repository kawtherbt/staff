const pool = require('../db/dbConnection');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { z } = require('zod');

// 🔴 SUPPRIMÉ : const secret = require('../secret');
const signUp = async (req, res) => {
    try {
        const signUpSchema = z.object({
            nom: z.string().trim().min(1, { message: "Nom is required" }),
            email: z.string().email({ message: "Invalid email format" }),
            password: z.string().trim().min(1, { message: "Password is required" }).optional(),
            role: z.enum(["super_admin", "admin", "super_user", "user"], { message: "Invalid role" }),
            type: z.enum(["temporaire", "permanent"], { message: "Invalid type" }),
            activation_date: z.string().optional().refine(val => !val || !isNaN(new Date(val).getTime()), {
                message: "Invalid activation date format"
            }),
            deactivation_date: z.string().optional().refine(val => !val || !isNaN(new Date(val).getTime()), {
                message: "Invalid deactivation date format"
            }),
            entreprise_id: z.number(1).optional(),
            staff_id: z.number().int().optional(),
            // status retiré ici
        });

        const result = signUpSchema.safeParse(req.body);
        if (!result.success) {
            return res.status(400).json({ errors: result.error.errors });
        }

        const { nom, email, password, role, type, activation_date, deactivation_date, entreprise_id } = req.body;

        if ((type === 'temporaire') && (!activation_date || !deactivation_date)) {
            return res.status(400).json({ success: false, message: "missing data" });
        }

        const crypted_password = await bcrypt.hash(password || nom, 10);

        const decoded_token = req.decoded_token;
        let queryPart = '';
        let roleDependentValue;

        if (decoded_token.role === "super_admin") {
            queryPart = '$1';
            roleDependentValue = entreprise_id;
        } else {
            queryPart = `(SELECT entreprise_id FROM accounts WHERE "ID"=$1)`;
            roleDependentValue = decoded_token.id;
        }

        let query = '';
        let values = [];

        if (type === 'temporaire') {
            query = `INSERT INTO accounts (entreprise_id, nom, email, password, role, type, activation_date, deactivation_date) VALUES (${queryPart}, $2, $3, $4, $5, $6, $7, $8)`;
            values = [roleDependentValue, nom, email, crypted_password, role, type, activation_date, deactivation_date];
        } else {
            query = `INSERT INTO accounts (entreprise_id, nom, email, password, role, type) VALUES (${queryPart}, $2, $3, $4, $5, $6)`;
            values = [roleDependentValue, nom, email, crypted_password, role, type];
        }

        await pool.query(query, values);
        return res.status(200).json({ success: true, message: "account added with success" });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

const logIn = async (req, res) => {
    try {
        console.log("login reached");
        const signUpSchema = z.object({
            email: z.string().email({ message: "Invalid email format" }),
            password: z.string().trim().min(1, { message: "Password is required" }),
        });

        const result = signUpSchema.safeParse(req.body);
        if (!result.success) {
            return res.status(400).json({ errors: result.error.errors });
        }

        const { email, password } = req.body;

        const query = 'SELECT a."ID", a.email, a.password, a.role, a.type, a.activation_date, a.deactivation_date, a.nom, (SELECT nom FROM entreprise WHERE "ID" = a.entreprise_id) AS entreprise_nom FROM accounts a WHERE a.email = $1';
        const values = [email];

        const dbresult = await pool.query(query, values);
        const account = dbresult.rows[0];

        if (!account) {
            return res.status(401).json({ success: false, message: "account email does not exist" });
        }

        if (!(await bcrypt.compare(password, account.password))) {
            return res.status(402).json({ success: false, message: "wrong password" });
        }

        // 🔵 Secret écrit en clair ici :
        const token = jwt.sign({ id: account.ID, role: account.role }, "kawther", { expiresIn: '10h' });

        await pool.query('UPDATE accounts SET token = $1 WHERE "ID" = $2', [token, account.ID]);

        return res.status(200)
            .cookie('token', token, {
                httpOnly: true,
                secure: false,
                sameSite: 'lax',
                domain: '',
                maxAge: 28800000
            })
            .json({
                success: true,
                message: "loged in with success",
                data: {
                    ID: account.ID,
                    email: account.email,
                    role: account.role,
                    type: account.type,
                    activation_date: account.activation_date,
                    deactivation_date: account.deactivation_date,
                    nom: account.nom,
                    status: account.status,
                    entreprise_nom: account.entreprise_nom,
                    token: token,
                    staff_id: account.staff_id
                }
            });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

// 🔽 Les autres fonctions ne sont pas concernées par le secret JWT donc inchangées 🔽

const updateAccount = async (req,res)=>{
    try {
        const updateSchema = z.object({
            nom: z.string().trim().min(1, { message: "Nom is required" }).optional(),
            email: z.string().email({ message: "Invalid email format" }).optional(),
            password: z.string().trim().min(1, { message: "Password is required" }).optional(),
            role: z.enum(["super_admin", "admin", "super_user", "user"], { message: "Invalid role" }).optional(),
            type: z.enum(["temporaire", "permanent"], { message: "Invalid type" }).optional(),
            activation_date: z.string().optional().refine(val => !val || !isNaN(new Date(val).getTime()), {
                message: "Invalid activation date format"
            }).optional(),
            deactivation_date: z.string().optional().refine(val => !val || !isNaN(new Date(val).getTime()), {
                message: "Invalid deactivation date format"
            }).optional(),
            ID: z.number(1).optional(),
        });

        const result = updateSchema.safeParse(req.body);

        if (!result.success) {
            return res.status(400).json({ errors: result.error.errors });
        }

        let {nom,email,password,role,type,activation_date,deactivation_date,ID} = req.body;

        if(!ID||([nom,email,password,role,type,activation_date,deactivation_date].every((value)=>(value===undefined||value==="")))){
            return res.status(400).json({success:false,message:"missing data"});
        }

        if((type === 'temporaire')&&(!activation_date||!deactivation_date)){
            return res.status(400).json({success:false,message:"missing data"});
        }

        if(password){
            password = await bcrypt.hash(password,10);
        }
          
        let acceptedroles=[];
        
        const decoded_token = req.decoded_token;

        if(decoded_token.role==="super_admin"){
            acceptedroles=["user","super_user","admin"];
        }else if(decoded_token.role==="admin"){
            acceptedroles=["user","super_user"];
        }else if(decoded_token.role==="super_user"){
            acceptedroles=["user"];
        }else{
            return res.status(403).json({success : false, message: "missing privilege"});
        }


        const data = {nom,email,password,role,type,activation_date,deactivation_date}

        const FilteredBody = Object.fromEntries(Object.entries(data).filter(([_,value])=>(value!==undefined&&value!==null&&value!=="")));

        const columns = Object.keys(FilteredBody);
        const values = Object.values(FilteredBody);

        values.push(ID);
        values.push(acceptedroles);
        values.push(decoded_token.id);


        const columnsString = (columns.map((column,index)=>`${column}=$${index+1}`)).join(',');
        const query = `UPDATE accounts SET ${columnsString} WHERE "ID"=$${columns.length+1} AND (role = ANY($${columns.length+2}) OR "ID"=$${columns.length+3}) AND entreprise_id = (SELECT entreprise_id FROM accounts WHERE "ID"=$${columns.length+3})`;

        const {rowCount} = await pool.query(query,values);

        if(rowCount === 0){
            return res.status(200).json({success : true, message: "no account was updated"});
        }

        return res.status(200).json({success : true, message: "account updated with success"});
    } catch (error) {
        return res.status(500).json({success:false,message:error.message});
    }
}

const deleteAccount = async (req,res)=>{
    try {
        console.log("delete accounts reached");
        const deleteSchema = z.object({
            IDs: z.array(z.number().int()).min(1),
        });

        const result = deleteSchema.safeParse(req.body);

        if (!result.success) {
            return res.status(400).json({ errors: result.error.errors });
        }

        const {IDs} = result.data;

        const decoded_token= req.decoded_token;

        if(!decoded_token.id||!decoded_token.role){
            return res.status(400).json({ message:"missing data" });
        }

        let acceptedroles=[];

        if(decoded_token.role==="super_admin"){
            acceptedroles=["user","super_user","admin"];
        }else if(decoded_token.role==="admin"){
            acceptedroles=["user","super_user"];
        }else if(decoded_token.role==="super_user"){
            acceptedroles=["user"];
        }else{
            return res.status(403).json({success : false, message: "missing privilege"});
        }


        const query = 'DELETE FROM accounts WHERE ("ID"= ANY ($1)) AND (role = ANY($2) OR "ID"=$3) AND entreprise_id = (SELECT entreprise_id FROM accounts WHERE "ID"=$3)';
        const values = [IDs,acceptedroles,decoded_token.id];

        const {rowCount} = await pool.query(query,values);

        if(rowCount === 0){
            return res.status(404).json({success : false, message: "no accounts where deleted"});
        }

        return res.status(200).json({success : true, message: "accounts deleted with success"});
    } catch (error) {
        return res.status(500).json({success:false,message:error.message});
    }
}

const getAcounts = async(req,res)=>{
    try {
        const token = req.cookies ? req.cookies.token : null;
        if(!token){
            return res.status(400).json({success:false,message:"missing data"});
        }

        const decoded_token = jwt.decode(token);

        let query = '';
        let values = [];
        
        if(decoded_token.role === 'super_admin'){

            query = 'SELECT "ID",nom,email,role,type,activation_date,deactivation_date FROM accounts';

            const result = await pool.query(query);

            return res.status(200).json({success : true, message: "fetched accounts with success",data:result.rows});
        }

        if(decoded_token.role === 'admin'){

            query = 'SELECT "ID",nom,email,role,type,activation_date,deactivation_date FROM accounts WHERE "ID" IN (SELECT "ID" FROM accounts WHERE entreprise_id IN(SELECT entreprise_id FROM accounts WHERE "ID"=$1))';
            values = [decoded_token.id]

            const result = await pool.query(query,values);
            
            return res.status(200).json({success : true, message: "fetched accounts with success",data:result.rows});
        }

        return res.status(401).json({success : true, message: "not enough privilege",data:result.rows});
 
    } catch (error) {
        return res.status(500).json({success:false,message:error.message});
    }
}

module.exports = {signUp,logIn,updateAccount,deleteAccount,getAcounts}