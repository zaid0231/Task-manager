const express = require("express");
const bcrypt = require("bcryptjs");
const { body, validationResult } = require("express-validator");
const { db } = require("../db");
const { generateToken, authenticate } = require("../middleware/auth");

const router = express.Router();

router.post(
  "/signup",
  body("name").trim().notEmpty(),
  body("email").isEmail().normalizeEmail(),
  body("password").isLength({ min: 6 }),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, email, password } = req.body;
    const existing = await db("users").where({ email }).first();
    if (existing) {
      return res.status(400).json({ message: "Email already registered" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const [userId] = await db("users").insert({
      name,
      email,
      password: hashedPassword,
    });
    const user = await db("users").where({ id: userId }).first();
    const token = generateToken(user);
    res.json({
      token,
      user: { id: user.id, name: user.name, email: user.email },
    });
  },
);

router.post(
  "/login",
  body("email").isEmail().normalizeEmail(),
  body("password").notEmpty(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;
    const user = await db("users").where({ email }).first();
    if (!user) {
      return res.status(400).json({ message: "Invalid email or password" });
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return res.status(400).json({ message: "Invalid email or password" });
    }

    const token = generateToken(user);
    res.json({
      token,
      user: { id: user.id, name: user.name, email: user.email },
    });
  },
);

router.get("/me", authenticate, async (req, res) => {
  const user = await db("users").where({ id: req.user.id }).first();
  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }
  res.json({ id: user.id, name: user.name, email: user.email });
});

module.exports = router;
