const express = require('express')
const cors = require('cors')
const authRouter = require('./routes/auth.route')
const adminRouter = require('./routes/admin.route')
const cookieParser = require("cookie-parser");
const bookingRoutes = require("./routes/booking.route");
const userRouter = require("./routes/user.route");

const app = express()

let allowedOrigins = [
    (process.env.FRONTEND_URL || 'https://venue-frontend-indol.vercel.app').trim(),
    'https://seo.sistec.ac.in',
    'http://seo.sistec.ac.in',
    'http://localhost:5173',
    'http://localhost:3000'
];

allowedOrigins = allowedOrigins.map(url => {
    url = url.trim();
    if (url.endsWith('/')) url = url.slice(0, -1);
    // Only prepend https if it's not localhost and doesn't have a protocol
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = 'https://' + url;
    }
    return url;
});

app.use(cors({ origin: allowedOrigins, credentials: true })); // Frontend production url
app.use(cookieParser());
app.use(express.json())


app.get('/', (req,res)=> {
    res.send("hello api hited")
} )

app.use('/api/auth', authRouter)
app.use("/api/admin", adminRouter);
app.use("/api/booking", bookingRoutes);
app.use("/api/user", userRouter);
module.exports =app