const express = require('express')
const cors = require('cors')
const authRouter = require('./routes/auth.route')
const adminRouter = require('./routes/admin.route')
const cookieParser = require("cookie-parser");
const bookingRoutes = require("./routes/booking.route");

const app = express()

let frontendUrl = (process.env.FRONTEND_URL || 'https://venue-frontend-indol.vercel.app').trim();
if (frontendUrl.endsWith('/')) {
    frontendUrl = frontendUrl.slice(0, -1);
}
// Ensure it has a protocol
if (!frontendUrl.startsWith('http://') && !frontendUrl.startsWith('https://')) {
    frontendUrl = 'https://' + frontendUrl;
}
app.use(cors({ origin: frontendUrl, credentials: true })); // Frontend production url
app.use(cookieParser());
app.use(express.json())


app.get('/', (req,res)=> {
    res.send("hello api hited")
} )

app.use('/api/auth', authRouter)
app.use("/api/admin", adminRouter);
app.use("/api/booking", bookingRoutes);
module.exports =app