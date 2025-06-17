const jwt = require("jsonwebtoken");

function auth(req, res, next) {
    console.log("auth middleware reached");
    const authHeader = req.headers["authorization"];
    console.log(JSON.stringify(authHeader));

    let token = null;
    if (authHeader && authHeader.startsWith("Bearer ")) {
        token = authHeader.split(" ")[1];
    } else if (req.cookies?.token) {
        token = req.cookies?.token;
    }

    console.log("token:", token);
    if (!token) {
        console.log("missing token");
        return res.status(401).json({ success: false, message: "Missing token" });
    }

    jwt.verify(token, "kawther", (err, decoded) => {
        if (err) {
            console.log(err.message);
            return res.status(403).json({ success: false, message: "Invalid Token" });
        }
        req.decoded_token = decoded;
        next();
    });
}

module.exports = auth;
