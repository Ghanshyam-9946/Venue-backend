const express = require('express')
const cors = require('cors')
const authRouter = require('./routes/auth.route')
const adminRouter = require('./routes/admin.route')
const cookieParser = require("cookie-parser");
const bookingRoutes = require("./routes/booking.route");

const app = express()

app.use(cors({ origin: process.env.FRONTEND_URL || 'https://venue-frontend-indol.vercel.app', credentials: true })); // Frontend production url
app.use(cookieParser());
app.use(express.json())


app.get('/', (req,res)=> {
    res.send("hello api hited")
} )

app.use('/api/auth', authRouter)
app.use("/api/admin", adminRouter);
app.use("/api/booking", bookingRoutes);
module.exports =app