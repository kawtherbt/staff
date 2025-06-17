const pool = require("../db/dbConnection");
const {z} = require("zod");

const addStaff = async (req, res) => {
    try {
        const staffSchema = z.object({
            nom: z.string().trim().min(1, { message: "Nom is required" }),
            prenom: z.string().min(1, { message: "Last name is required" }).optional(),
            role: z.string().min(1, { message: "Role is required" }),
            departement: z.string().min(1, { message: "Department is required" }).optional(),
            num_tel: z.number().int().optional(),
            email: z.string().email({ message: "Invalid email format" }).optional(),
            team_id: z.number().int().optional(),
            agence_id: z.number().int().min(1, { message: "Agency ID is required" }),
            available: z.boolean().optional().default(false)
        });

        const result = staffSchema.safeParse(req.body);

        if (!result.success) {
            console.log("Validation error:", result.error.errors);
            return res.status(400).json({ errors: result.error.errors });
        }

        const decoded_token = req.decoded_token;
        if (!decoded_token) {
            console.log("No token found");
            return res.status(401).json({ success: false, message: "Authentication required" });
        }

        const { nom, prenom, num_tel, email, departement, role, team_id, agence_id, available } = req.body;
        console.log("Received staff data:", req.body);

        // First verify that the agence exists
        const agenceCheckQuery = 'SELECT "ID" FROM agence WHERE "ID" = $1';
        const agenceCheck = await pool.query(agenceCheckQuery, [agence_id]);
        
        if (agenceCheck.rowCount === 0) {
            console.log("Agency not found:", agence_id);
            return res.status(404).json({ 
                success: false, 
                message: "Specified agency does not exist" 
            });
        }

        const query = `
            INSERT INTO staff (
                nom, prenom, num_tel, email, departement, role, team_id, 
                entreprise_id, agence_id, available
            ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, 
                (SELECT entreprise_id FROM accounts WHERE "ID" = $8), $9, $10
            ) RETURNING "ID", nom, prenom, role, departement, num_tel, email, team_id, agence_id, available
        `;
        
        const values = [
            nom, prenom, num_tel, email, departement, role, team_id,
            decoded_token.id, agence_id, available ?? false
        ];
        console.log("Query:", query);
        console.log("Values:", values);

        const data = await pool.query(query, values);
        console.log("Insert result:", data.rows[0]);

        if (data.rowCount === 0) {
            return res.status(400).json({ success: false, message: "Failed to add staff" });
        }

        return res.status(200).json({
            success: true,
            message: "Staff added successfully",
            data: data.rows[0]
        });
    } catch (error) {
        console.error("Error adding staff:", error);
        return res.status(500).json({ success: false, message: error.message });
    }
}

const addStaffWithAgence = async (req, res) => {
    try {
        const staffSchema = z.object({
            prenom: z.string().min(1, { message: "First name is required" }),
            nom: z.string().trim().min(1, { message: "Last name is required" }),
            num_tel: z.number().int({ message: "Phone number must be a number" }),
            email: z.string().email({ message: "Invalid email format" }),
            agence_id: z.number().int().min(1, { message: "Agency ID is required" }),
            role: z.string().min(1, { message: "Role is required" }),
            start_date: z.string().refine((val) => !isNaN(new Date(val).getTime()), {
                message: "Invalid start date format"
            }).optional(),
            end_date: z.string().refine((val) => !isNaN(new Date(val).getTime()), {
                message: "Invalid end date format"
            }).optional(),
            evenement_id: z.number().int().min(1, { message: "Event ID must be a positive number" }).optional(),
            departement: z.string().nullable().optional(),
            team_id: z.number().int().nullable().optional(),
            available: z.boolean().optional().default(false)
        });

        const result = staffSchema.safeParse(req.body);

        if (!result.success) {
            console.log("Validation error:", result.error.errors);
            return res.status(400).json({ errors: result.error.errors });
        }

        const decoded_token = req.decoded_token;
        if (!decoded_token) {
            console.log("No token found");
            return res.status(401).json({ success: false, message: "Authentication required" });
        }

        const { 
            prenom, 
            nom, 
            num_tel, 
            email, 
            agence_id, 
            role, 
            start_date, 
            end_date,
            evenement_id,
            departement,
            team_id,
            available 
        } = req.body;

        console.log("Received staff data:", req.body);

        // First verify that the agence exists
        const agenceCheckQuery = 'SELECT "ID" FROM agence WHERE "ID" = $1';
        const agenceCheck = await pool.query(agenceCheckQuery, [agence_id]);
        
        if (agenceCheck.rowCount === 0) {
            console.log("Agency not found:", agence_id);
            return res.status(404).json({ 
                success: false, 
                message: "Specified agency does not exist" 
            });
        }

        // Start a transaction
        await pool.query('BEGIN');

        try {
            // Convert boolean to smallint (0 or 1)
            const availableValue = (available ?? false) ? 1 : 0;

            // Insert into staff table
            const staffQuery = `
                INSERT INTO staff (
                    nom, prenom, num_tel, email, departement, role, team_id, 
                    entreprise_id, agence_id, available
                ) VALUES (
                    $1, $2, $3, $4, $5, $6, $7, 
                    (SELECT entreprise_id FROM accounts WHERE "ID" = $8), $9, $10
                ) RETURNING "ID", nom, prenom, role, departement, num_tel, email, team_id, agence_id, available
            `;
            
            const staffValues = [
                nom, 
                prenom, 
                num_tel, 
                email, 
                departement || null, 
                role, 
                team_id || null,
                decoded_token.id, 
                agence_id, 
                availableValue
            ];

            console.log("Staff Query:", staffQuery);
            console.log("Staff Values:", staffValues);

            const staffResult = await pool.query(staffQuery, staffValues);
            console.log("Staff Insert result:", staffResult.rows[0]);

            if (staffResult.rowCount === 0) {
                await pool.query('ROLLBACK');
                return res.status(400).json({ success: false, message: "Failed to add staff" });
            }

            let listeStaffResult = null;

            // Only create liste_staff entry if evenement_id is provided
            if (evenement_id) {
                // Verify that the event exists and belongs to the user's enterprise
                const eventCheckQuery = `
                    SELECT "ID" 
                    FROM evenement 
                    WHERE "ID" = $1 
                    AND client_id IN (
                        SELECT "ID" 
                        FROM "Clients" 
                        WHERE entreprise_id = (SELECT entreprise_id FROM accounts WHERE "ID" = $2)
                    )
                `;
                const eventCheck = await pool.query(eventCheckQuery, [evenement_id, decoded_token.id]);
                
                if (eventCheck.rowCount === 0) {
                    await pool.query('ROLLBACK');
                    return res.status(404).json({ 
                        success: false, 
                        message: "Specified event does not exist or you don't have access to it" 
                    });
                }

                // Insert into liste_staff table
                const listeStaffQuery = `
                    INSERT INTO "Liste_staff" (
                        staff_id, 
                        evenement_id,
                        date_debut,
                        date_fin,
                        has_agency
                    ) VALUES (
                        $1, 
                        $2,
                        $3,
                        $4,
                        $5
                    ) RETURNING *
                `;

                const listeStaffValues = [
                    staffResult.rows[0].ID,
                    evenement_id,
                    start_date || null,
                    end_date || null,
                    1  // Setting has_agency to 1
                ];

                console.log("Liste Staff Query:", listeStaffQuery);
                console.log("Liste Staff Values:", listeStaffValues);

                listeStaffResult = await pool.query(listeStaffQuery, listeStaffValues);
                console.log("Liste Staff Insert result:", listeStaffResult.rows[0]);
            }

            await pool.query('COMMIT');

            return res.status(200).json({
                success: true,
                message: "Staff added successfully" + (evenement_id ? " with event assignment" : ""),
                data: {
                    staff: staffResult.rows[0],
                    ...(listeStaffResult && { event_assignment: listeStaffResult.rows[0] })
                }
            });
        } catch (error) {
            await pool.query('ROLLBACK');
            throw error;
        }
    } catch (error) {
        console.error("Error adding staff with agency:", error);
        return res.status(500).json({ success: false, message: error.message });
    }
}


const updateStaff = async (req,res)=>{
    try {
        const staffSchema = z.object({
            ID: z.number().int().min(1),
            nom: z.string().trim().min(1, { message: "Nom is required" }).optional(),
            prenom: z.string().min(1, { message: "Last name is required" }).optional(),
            role: z.string().min(1, { message: "Role is required" }).optional(),
            departement: z.string().min(1, { message: "Department is required" }).optional(),
            num_tel: z.number().int().optional(),
            email: z.string().email({ message: "Invalid email format" }).optional(),
            team_id: z.number().int().optional(),
            agence_id: z.number().int().min(1, { message: "Agency ID is required" }).optional(),
            available: z.boolean().optional()
        });

        const result = staffSchema.safeParse(req.body);

        if (!result.success) {
            return res.status(400).json({ errors: result.error.errors });
        }

        const {ID, nom, prenom, num_tel, email, departement, role, team_id, agence_id, available} = result.data;

        if(!ID || [nom, prenom, num_tel, email, departement, role, team_id, agence_id, available].every(value => value === undefined)){
            return res.status(400).json({success: false, message: "No fields to update"});
        }

        const data = {nom, prenom, num_tel, email, departement, role, team_id, agence_id, available};
        const filteredData = Object.fromEntries(
            Object.entries(data).filter(([_, value]) => value !== undefined && value !== null && value !== "")
        );

        if (Object.keys(filteredData).length === 0) {
            return res.status(400).json({success: false, message: "No valid fields to update"});
        }

        const columns = Object.keys(filteredData);
        const values = Object.values(filteredData);
        values.push(ID);

        const columnsString = columns.map((column, index) => `${column} = $${index + 1}`).join(', ');
        const query = `UPDATE staff SET ${columnsString} WHERE "ID" = $${values.length} RETURNING *`;

        const updateResult = await pool.query(query, values);
        
        if (updateResult.rowCount === 0) {
            return res.status(404).json({success: false, message: "Staff not found"});
        }

        return res.status(200).json({
            success: true, 
            message: "Staff updated successfully",
            data: updateResult.rows[0]
        });
    } catch (error) {
        console.error("Error updating staff:", error);
        return res.status(500).json({success: false, message: error.message});
    }
}

const deleteStaff = async(req,res)=>{
    try {
        const staffSchema = z.object({
            ID: z.number().int().min(1)
        });

        const result = staffSchema.safeParse(req.body);

        if (!result.success) {
            return res.status(400).json({ errors: result.error.errors });
        }

        const {ID} = req.body;

        const query = 'DELETE FROM staff WHERE "ID" = $1 RETURNING *';
        const values = [ID];

        const deleteResult = await pool.query(query, values);
        
        if (deleteResult.rowCount === 0) {
            return res.status(404).json({success: false, message: "Staff not found"});
        }

        return res.status(200).json({
            success: true, 
            message: "Staff deleted successfully",
            deletedStaff: deleteResult.rows[0]
        });
    } catch (error) {
        console.error("Error deleting staff:", error);
        return res.status(500).json({success: false, message: error.message});
    }
}

const getAllStaff = async (req,res)=>{
    try {
        const decoded_token = req.decoded_token;

        if(!decoded_token){
            return res.status(401).json({success: false, message: "Authentication required"});
        }

        const query = `
            SELECT 
                s."ID",
                s.nom,
                s.prenom,
                s.email,
                s.departement,
                s.num_tel,
                s.role,
                s.available,
                s.agence_id,
                t.nom AS team_nom,
                a.nom AS agence_nom
            FROM staff s
            LEFT JOIN team t ON s.team_id = t."ID"
            LEFT JOIN agence a ON s.agence_id = a."ID"
            WHERE s.entreprise_id = (SELECT entreprise_id FROM accounts WHERE "ID" = $1)
        `;
        const values = [decoded_token.id];

        const data = await pool.query(query, values);
        
        return res.status(200).json({
            success: true, 
            message: "Staff fetched successfully",
            data: data.rows
        });
    } catch (error) {
        console.error("Error fetching staff:", error);
        return res.status(500).json({success: false, message: error.message});
    }
}

const getParticipation = async (req,res)=>{
    try {
        const decoded_token = req.decoded_token;

        if(!decoded_token){
            return res.status(400).json({success:false,message:"missing data"});
        }

        const query = `SELECT ls.staff_id , e.date_debut ,e.nom
                        FROM evenement e
                        LEFT JOIN "Liste_staff" ls ON ls.evenement_id = e."ID"
                        WHERE e.client_id = ANY(SELECT "ID" FROM "Clients" WHERE entreprise_id=(SELECT entreprise_id FROM accounts WHERE "ID" = $1))
                        AND e.date_debut BETWEEN date_trunc('month', CURRENT_DATE) - INTERVAL '5 months' AND CURRENT_DATE`;
        const values = [decoded_token.id];

        const data = await pool.query(query,values);
        if(!data){
            return res.status(400).json({"success":false , message:"failure"});
        }
        return res.status(200).json({success: true, message : "participation fetched with success",data:data.rows});
    } catch (error) {
        return res.status(500).json({success:false,message:error.message});
    }
}

const getStaffEvents = async (req,res)=>{
    try {
        const staffSchema = z.object({
            staff_id: z.number().int().min(1),
        });

        const result = staffSchema.safeParse({staff_id:Number(req.params.id)});

        if (!result.success) {
            return res.status(400).json({ errors: result.error.errors });
        }

        const {staff_id} = result.data;

        const decoded_token = req.decoded_token;

        if(!decoded_token){
            return res.status(400).json({success:false,message:"missing data"});
        }
        

        const query = `SELECT e."ID" AS event_id,e.nom AS event_name,e.date_debut AS date_debut,e.date_fin AS date_fin,e.type AS type,e.edition AS edition,e.nbr_invite AS nbr_invite ,e.description AS description,e.address AS address,e.client_id AS client_id,c.nom AS client_name
                        FROM evenement e
                        JOIN "Liste_staff" ls ON ls.evenement_id = e."ID"
                        JOIN staff s ON ls.staff_id = s."ID" 
                        LEFT JOIN "Clients" c ON c."ID"=e.client_id
                        WHERE s."ID" = $1 AND s.entreprise_id = (SELECT entreprise_id FROM accounts WHERE "ID" = $2)`;
        const values = [staff_id,decoded_token.id];

        const data = await pool.query(query,values);

        if(data.rowCount === 0){
            return res.status(400).json({"success":false , message:"failure"});
        }
        return res.status(200).json({success: true, message : "staffs events fetched with success",data:data.rows});
    } catch (error) {
        return res.status(500).json({success:false,message:error.message});
    }
}

const getEventStaff = async(req,res)=>{
    try{
        const StaffSchema = z.object({
            ID: z.number().int().min(1),
        });

        const result = StaffSchema.safeParse({ID:Number(req.params.ID)});

        if (!result.success) {
            return res.status(400).json({ errors: result.error.errors });
        }

        const {ID} = result.data;

        const decoded_token = req.decoded_token;
        if(!decoded_token){
            return res.status(400).json({success:false,message:"missing data"});
        }

        const query = `SELECT st.nom AS staff_name, st.prenom AS staff_lastname , st.num_tel , st.email, st.departement, st.role, st.available, 
                        FROM staff st
                        JOIN "Liste_staff" ls ON ls.staff_id = st."ID" 
                        LEFT JOIN team te ON st.team_id = te."ID"
                        WHERE ls.evenement_id = $1
                        AND st.entreprise_id=(SELECT entreprise_id FROM accounts WHERE "ID" = $2)`;
        const values = [ID,decoded_token.id]; 

        const data = await pool.query(query,values);
        if(!data){
            return res.status(400).json({"success":false , message:"failure"});
        }
        res.status(200).json({success:true , message:"success",data:data.rows});
    }catch(error){
        console.error("error while getting the events",error);
        res.status(500).json({success:false,message:"error while getting the events",err:error.message});
    }
}

const getAvailabeEventStaff = async(req,res)=>{
    try{
        const StaffSchema = z.object({
            start_date: z.string().refine((value) => {
                const date = new Date(value);
                return !isNaN(date.getTime());
            }, {
                message: "Invalid timestamp format",
            }),
            end_date: z.string().refine((value) => {
                const date = new Date(value);
                return !isNaN(date.getTime());
            }, {
                message: "Invalid timestamp format",
            }),
        });

        const result = StaffSchema.safeParse({start_date:params.start_date,end_date:params.end_date});

        if (!result.success) {
            return res.status(400).json({ errors: result.error.errors });
        }

        const {start_date,end_date} = result.data;

        const decoded_token = req.decoded_token;
        if(!decoded_token){
            return res.status(400).json({success:false,message:"missing data"});
        }

        const query = `SELECT ls."ID" AS ls_id,CASE WHEN ls."ID" IS NULL THEN TRUE ELSE FALSE END AS disponible
                        FROM staff st
                        JOIN "Liste_staff" ls ON ls.staff_id = st."ID" 
                        LEFT JOIN team tm ON st.team_id = tm."ID"
                        LEFT JOIN evenement ev ON le.evenement_id = ev."ID" AND (ev.date_debut >= $2 OR ev.date_fin <= $1)
                        WHERE st.entreprise_id=(SELECT entreprise_id FROM accounts WHERE "ID" = $3)`;
        const values = [start_date,end_date,decoded_token.id]; 

        const data = await pool.query(query,values);
        if(!data){
            return res.status(400).json({"success":false , message:"failure"});
        }
        res.status(200).json({success:true , message:"success",data:data.rows});
    }catch(error){
        console.error("error while getting the staff",error);
        res.status(500).json({success:false,message:"error while getting the staff",err:error.message});
    }
}


const addStaffToEvent = async(req,res)=>{
    try{
        const staffSchema = z.object({
            staff_id: z.number().int().min(1, { message: "Staff ID is required" }),
            evenement_id: z.number().int().min(1, { message: "Event ID is required" })
        });

        const result = staffSchema.safeParse(req.body);

        if (!result.success) {
            return res.status(400).json({ errors: result.error.errors });
        }

        const {staff_id, evenement_id} = result.data;

        const decoded_token = req.decoded_token;
        if(!decoded_token){
            return res.status(401).json({success: false, message: "Authentication required"});
        }

        // First check if the staff and event belong to the same entreprise
        const checkQuery = `
            SELECT 1 
            FROM staff s
            JOIN evenement e ON e.client_id IN (
                SELECT c."ID" 
                FROM "Clients" c 
                WHERE c.entreprise_id = s.entreprise_id
            )
            WHERE s."ID" = $1 
            AND e."ID" = $2
            AND s.entreprise_id = (SELECT entreprise_id FROM accounts WHERE "ID" = $3)
        `;
        
        const checkResult = await pool.query(checkQuery, [staff_id, evenement_id, decoded_token.id]);
        
        if (checkResult.rowCount === 0) {
            return res.status(403).json({
                success: false, 
                message: "Staff or event not found, or they don't belong to your enterprise"
            });
        }

        // Check if the staff is already assigned to this event
        const existingQuery = `
            SELECT 1 
            FROM "Liste_staff" 
            WHERE staff_id = $1 AND evenement_id = $2
        `;
        
        const existingResult = await pool.query(existingQuery, [staff_id, evenement_id]);
        
        if (existingResult.rowCount > 0) {
            return res.status(400).json({
                success: false, 
                message: "Staff is already assigned to this event"
            });
        }

        // Start a transaction to ensure both operations succeed or fail together
        await pool.query('BEGIN');

        try {
            // Insert the new assignment
            const insertQuery = `
                INSERT INTO "Liste_staff" (staff_id, evenement_id) 
                VALUES ($1, $2) 
                RETURNING *
            `;
            
            const insertResult = await pool.query(insertQuery, [staff_id, evenement_id]);

            // Update staff availability to 0
            const updateQuery = `
                UPDATE staff 
                SET available = 0 
                WHERE "ID" = $1 
                RETURNING "ID", nom, available
            `;
            
            const updateResult = await pool.query(updateQuery, [staff_id]);

            await pool.query('COMMIT');

            return res.status(200).json({
                success: true, 
                message: "Staff successfully assigned to event and marked as unavailable",
                data: {
                    assignment: insertResult.rows[0],
                    staff: updateResult.rows[0]
                }
            });
        } catch (error) {
            await pool.query('ROLLBACK');
            throw error;
        }
    } catch (error) {
        console.error("Error assigning staff to event:", error);
        return res.status(500).json({
            success: false, 
            message: "Error assigning staff to event", 
            error: error.message
        });
    }
}


const removeStaffFromEvent = async(req,res)=>{
    try{
        const StaffSchema = z.object({
            ID_event: z.number().int().min(1),
            ID_staff: z.number().int().min(1), 
        });

        const result = StaffSchema.safeParse({ID_event:Number(req.params.ID_event),ID_staff:Number(params.ID_staff)});

        if (!result.success) {
            return res.status(400).json({ errors: result.error.errors });
        }

        const {ID_event,ID_staff} = result.data;

        const decoded_token = req.decoded_token;
        if(!decoded_token){
            return res.status(400).json({success:false,message:"missing data"});
        }

        const acceptedroles=["super_admin","admin","super_user"];
        if(!acceptedroles.includes(decoded_token.role)){
            return res.status(403).json({success : false, message: "missing privilege"});
        }

        const query = `DELETE FROM "Liste_staff" WHERE (evenement_id = $1 AND staff_id = $2 AND ((SELECT role FROM accounts WHERE "ID"=$3 ) = ANY($4)))`;
        const values = [ID_event,ID_staff,decoded_token.id,acceptedroles]; 

        const data = await pool.query(query,values);
        if(!data){
            return res.status(400).json({"success":false , message:"failure"});
        }
        res.status(200).json({success:true , message:"success",data:data.rows});
    }catch(error){
        console.error("error while getting the staff",error);
        res.status(500).json({success:false,message:"error while getting the staff",err:error.message});
    }
}

const getAvailableStaff = async (req,res)=>{
    try {
        const decoded_token = req.decoded_token;

        if(!decoded_token){
            return res.status(401).json({success: false, message: "Authentication required"});
        }

        console.log("User ID from token:", decoded_token.id);

        const query = `
            SELECT 
                s."ID",
                s.nom,
                s.prenom,
                s.email,
                s.departement,
                s.num_tel,
                s.role,
                s.agence_id,
                s.available,
                t.nom AS team_nom,
                a.nom AS agence_nom
            FROM staff s
            LEFT JOIN team t ON s.team_id = t."ID"
            LEFT JOIN agence a ON s.agence_id = a."ID"
            WHERE s.entreprise_id = (SELECT entreprise_id FROM accounts WHERE "ID" = $1)
            AND s.available = 1
        `;
        const values = [decoded_token.id];

        console.log("Executing query:", query);
        console.log("With values:", values);

        const data = await pool.query(query, values);
        
        console.log("Query result count:", data.rows.length);
        console.log("First row sample:", data.rows[0]);

        // Let's also check the entreprise_id
        const entrepriseQuery = 'SELECT entreprise_id FROM accounts WHERE "ID" = $1';
        const entrepriseResult = await pool.query(entrepriseQuery, [decoded_token.id]);
        console.log("User's entreprise_id:", entrepriseResult.rows[0]?.entreprise_id);

        // Let's check all staff for this entreprise
        const allStaffQuery = `
            SELECT "ID", nom, available, entreprise_id 
            FROM staff 
            WHERE entreprise_id = $1
        `;
        const allStaffResult = await pool.query(allStaffQuery, [entrepriseResult.rows[0]?.entreprise_id]);
        console.log("All staff for entreprise:", allStaffResult.rows);
        
        return res.status(200).json({
            success: true, 
            message: "Available staff fetched successfully",
            data: data.rows
        });
    } catch (error) {
        console.error("Error fetching available staff:", error);
        return res.status(500).json({success: false, message: error.message});
    }
}

const getStaffByEvent = async(req,res)=>{
    try{
        console.log("Received request for event_id:", req.params.event_id);
        
        const eventSchema = z.object({
            event_id: z.string().regex(/^\d+$/, { message: "Event ID must be a numeric string" })
        });

        const result = eventSchema.safeParse({event_id: req.params.event_id});

        if (!result.success) {
            console.log("Validation error:", result.error.errors);
            return res.status(400).json({ errors: result.error.errors });
        }

        const {event_id} = result.data;
        console.log("Validated event_id:", event_id);

        const decoded_token = req.decoded_token;
        if(!decoded_token){
            console.log("No token found");
            return res.status(401).json({success: false, message: "Authentication required"});
        }

        console.log("User ID from token:", decoded_token.id);

        const query = `
            SELECT 
                s."ID",
                s.nom,
                s.prenom,
                s.email,
                s.departement,
                s.num_tel,
                s.role,
                s.available,
                s.agence_id,
                t.nom AS team_nom,
                a.nom AS agence_nom,
                ls."ID" AS assignment_id
            FROM staff s
            JOIN "Liste_staff" ls ON s."ID" = ls.staff_id
            LEFT JOIN team t ON s.team_id = t."ID"
            LEFT JOIN agence a ON s.agence_id = a."ID"
            WHERE ls.evenement_id = $1
            AND s.entreprise_id = (SELECT entreprise_id FROM accounts WHERE "ID" = $2)
        `;
        
        const values = [event_id, decoded_token.id];
        console.log("Executing query with values:", values);

        const data = await pool.query(query, values);
        console.log("Query returned rows:", data.rows.length);
        
        return res.status(200).json({
            success: true, 
            message: "Staff members fetched successfully",
            data: data.rows
        });
    } catch (error) {
        console.error("Error fetching staff by event:", error);
        return res.status(500).json({
            success: false, 
            message: "Error fetching staff members", 
            error: error.message
        });
    }
}

const setStaffAvailable = async(req,res)=>{
    try{
        const staffSchema = z.object({
            staff_id: z.number().int().min(1, { message: "Staff ID is required" }),
            evenement_id: z.number().int().min(1, { message: "Event ID is required" })
        });

        const result = staffSchema.safeParse(req.body);

        if (!result.success) {
            return res.status(400).json({ errors: result.error.errors });
        }

        const {staff_id, evenement_id} = result.data;

        const decoded_token = req.decoded_token;
        if(!decoded_token){
            return res.status(401).json({success: false, message: "Authentication required"});
        }

        // Start a transaction to ensure both operations succeed or fail together
        await pool.query('BEGIN');

        try {
            // First check if the staff is actually assigned to this event
            const checkQuery = `
                SELECT 1 
                FROM "Liste_staff" 
                WHERE staff_id = $1 AND evenement_id = $2
            `;
            
            const checkResult = await pool.query(checkQuery, [staff_id, evenement_id]);
            
            if (checkResult.rowCount === 0) {
                await pool.query('ROLLBACK');
                return res.status(404).json({
                    success: false, 
                    message: "Staff is not assigned to this event"
                });
            }

            // Delete from Liste_staff
            const deleteQuery = `
                DELETE FROM "Liste_staff" 
                WHERE staff_id = $1 AND evenement_id = $2
                RETURNING *
            `;
            
            const deleteResult = await pool.query(deleteQuery, [staff_id, evenement_id]);

            // Update staff availability to 1
            const updateQuery = `
                UPDATE staff 
                SET available = 1 
                WHERE "ID" = $1 
                RETURNING "ID", nom, available
            `;
            
            const updateResult = await pool.query(updateQuery, [staff_id]);

            await pool.query('COMMIT');

            return res.status(200).json({
                success: true, 
                message: "Staff successfully removed from event and marked as available",
                data: {
                    removed_assignment: deleteResult.rows[0],
                    staff: updateResult.rows[0]
                }
            });
        } catch (error) {
            await pool.query('ROLLBACK');
            throw error;
        }
    } catch (error) {
        console.error("Error updating staff availability:", error);
        return res.status(500).json({
            success: false, 
            message: "Error updating staff availability", 
            error: error.message
        });
    }
}

const getAllAgencies = async (req, res) => {
    try {
        const decoded_token = req.decoded_token;
        console.log("User token:", decoded_token);

        if (!decoded_token) {
            console.log("No token found");
            return res.status(401).json({ success: false, message: "Authentication required" });
        }

        const query = `
            SELECT 
                a."ID",
                a.nom
            FROM agence a
            ORDER BY a.nom ASC
        `;
        console.log("Query:", query);

        const data = await pool.query(query);
        console.log("Query result count:", data.rows.length);
        console.log("First agency:", data.rows[0]);
        console.log("All agencies:", data.rows);
        
        return res.status(200).json({
            success: true,
            message: "Agencies fetched successfully",
            data: data.rows
        });
    } catch (error) {
        console.error("Error fetching agencies:", error);
        return res.status(500).json({ success: false, message: error.message });
    }
}

const getAgenceTableStructure = async (req, res) => {
    try {
        const decoded_token = req.decoded_token;
        console.log("User token:", decoded_token);

        if (!decoded_token) {
            console.log("No token found");
            return res.status(401).json({ success: false, message: "Authentication required" });
        }

        const query = `
            SELECT 
                column_name,
                data_type,
                character_maximum_length,
                is_nullable,
                column_default
            FROM 
                information_schema.columns
            WHERE 
                table_schema = 'public'
                AND table_name = 'agence'
            ORDER BY 
                ordinal_position
        `;

        console.log("Query:", query);
        const data = await pool.query(query);
        console.log("Query result count:", data.rows.length);
        console.log("Table structure:", data.rows);
        
        return res.status(200).json({
            success: true,
            message: "Agence table structure fetched successfully",
            data: data.rows
        });
    } catch (error) {
        console.error("Error fetching agence table structure:", error);
        return res.status(500).json({ success: false, message: error.message });
    }
}

const getStaffWithAgencyByEvent = async (req, res) => {
    try {
        const eventSchema = z.object({
            evenement_id: z.number().int().min(1, { message: "Event ID must be a positive number" })
        });

        const result = eventSchema.safeParse(req.body);

        if (!result.success) {
            console.log("Validation error:", result.error.errors);
            return res.status(400).json({ errors: result.error.errors });
        }

        const { evenement_id } = result.data;

        const decoded_token = req.decoded_token;
        if (!decoded_token) {
            console.log("No token found");
            return res.status(401).json({ success: false, message: "Authentication required" });
        }

        const query = `
            SELECT 
                s."ID",
                s.nom,
                s.prenom,
                s.email,
                s.departement,
                s.num_tel,
                s.role,
                s.available,
                s.agence_id,
                a.nom AS agence_nom,
                ls.date_debut,
                ls.date_fin,
                ls.has_agency
            FROM staff s
            JOIN "Liste_staff" ls ON s."ID" = ls.staff_id
            JOIN agence a ON s.agence_id = a."ID"
            WHERE ls.evenement_id = $1
            AND s.agence_id IS NOT NULL
        `;

        const values = [evenement_id];

        console.log("Query:", query);
        console.log("Values:", values);

        const data = await pool.query(query, values);
        console.log("Query result count:", data.rows.length);

        return res.status(200).json({
            success: true,
            message: "Staff with agency fetched successfully",
            data: data.rows
        });
    } catch (error) {
        console.error("Error fetching staff with agency:", error);
        return res.status(500).json({ success: false, message: error.message });
    }
}

const deleteStaffAndAssignments = async (req, res) => {
    try {
        const staffSchema = z.object({
            staff_id: z.number().int().min(1, { message: "Staff ID must be a positive number" })
        });

        const result = staffSchema.safeParse(req.body);

        if (!result.success) {
            console.log("Validation error:", result.error.errors);
            return res.status(400).json({ errors: result.error.errors });
        }

        const { staff_id } = result.data;

        const decoded_token = req.decoded_token;
        if (!decoded_token) {
            console.log("No token found");
            return res.status(401).json({ success: false, message: "Authentication required" });
        }

        // Start a transaction
        await pool.query('BEGIN');

        try {
            // First delete from Liste_staff
            const deleteListeStaffQuery = `
                DELETE FROM "Liste_staff"
                WHERE staff_id = $1
                RETURNING *
            `;
            const listeStaffResult = await pool.query(deleteListeStaffQuery, [staff_id]);
            console.log("Deleted Liste_staff entries:", listeStaffResult.rows);

            // Then delete from staff
            const deleteStaffQuery = `
                DELETE FROM staff
                WHERE "ID" = $1
                RETURNING *
            `;
            const staffResult = await pool.query(deleteStaffQuery, [staff_id]);
            console.log("Deleted staff:", staffResult.rows);

            if (staffResult.rowCount === 0) {
                await pool.query('ROLLBACK');
                return res.status(404).json({
                    success: false,
                    message: "Staff not found"
                });
            }

            await pool.query('COMMIT');

            return res.status(200).json({
                success: true,
                message: "Staff and their assignments deleted successfully",
                data: {
                    deleted_staff: staffResult.rows[0],
                    deleted_assignments: listeStaffResult.rows
                }
            });
        } catch (error) {
            await pool.query('ROLLBACK');
            throw error;
        }
    } catch (error) {
        console.error("Error deleting staff and assignments:", error);
        return res.status(500).json({ success: false, message: error.message });
    }
}

module.exports = {
    addStaff,
    addStaffWithAgence,
    updateStaff,
    deleteStaff,
    getAllStaff,
    getParticipation,
    getStaffEvents,
    getEventStaff,
    getAvailabeEventStaff,
    addStaffToEvent,
    removeStaffFromEvent,
    getAvailableStaff,
    getStaffByEvent,
    setStaffAvailable,
    getAllAgencies,
    getAgenceTableStructure,
    getStaffWithAgencyByEvent,
    deleteStaffAndAssignments
}