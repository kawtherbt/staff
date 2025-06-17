const express = require('express');
const cors = require("cors");
const bodyParser = require("body-parser");
require("dotenv").config();
const cookieparser = require('cookie-parser');
const PORT = process.env.PORT || 3000;

// const eventRoutes = require("./routes/event/eventRoutes");
// const clientRoutes = require('./routes/client/clientRoutes');
// const departmentRoutes = require('./routes/client/department/departmentRoutes');
// const equipmentRoutes = require('./routes/equipement/equipmentRoutes');
 const authRoutes = require('./routes/authRoutes');
const staffRoutes = require('./routes/staffRoutes');
const teamRoutes = require('./routes/teamRoutes');
// const workshopRoutes = require('./routes/workshop/workshopRoutes');
// const soireeRoutes = require('./routes/soiree/soireeRoutes'); 
// const accomodationRoutes = require('./routes/accomodation/accomodationRoutes'); 
// const entrepriseRoutes = require('./routes/auth/entrepriseRoutes');
// const carRoutes = require('./routes/transport/car/carRoutes');
// const transportRoutes = require('./routes/transport/transportRoutes');
// const instructorRoutes = require('./routes/instructor/instructorRoutes');
// const QARoutes = require('./routes/workshop/QA/QARoutes');
// const prestataireRoutes = require('./routes/prestataire/prestataireRoutes');

const authMiddleware = require('./middlewares/authMiddleware');

const app = express();

app.listen(PORT, '0.0.0.0', () => {
  console.log('Server running on port 5000');
});
//app.use(cors({origin: 'http://0.0.0.0',credentials: true}));
app.use(cors({origin: (origin, callback) => {callback(null, true);},credentials: true}));
app.use(bodyParser.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieparser());

// Debug middleware to log all requests
app.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`);
  next();
});
app.get('/healthcheck', (_req, res) => {
  res.json({ status: 'ok' });
});


app.use('/api',authRoutes);

// app.use('/api',authMiddleware,eventRoutes);
// app.use('/api',clientRoutes);
// app.use('/api',authMiddleware,departmentRoutes);
// app.use('/api',authMiddleware,equipmentRoutes);

app.use('/api',authMiddleware,staffRoutes);
app.use('/api',authMiddleware,teamRoutes);
// app.use('/api',authMiddleware,workshopRoutes);
// app.use('/api',authMiddleware,soireeRoutes);
// app.use('/api',authMiddleware,accomodationRoutes);
// app.use('/api',authMiddleware,entrepriseRoutes);
// app.use('/api',authMiddleware,carRoutes);
// app.use('/api',authMiddleware,transportRoutes);
// app.use('/api',authMiddleware,instructorRoutes);
// app.use('/api',authMiddleware,QARoutes);
// app.use('/api',authMiddleware,prestataireRoutes);

module.exports = app ; 