# 🍔 FoodOrder — Online Food Ordering App

A full-stack food ordering web application built with React.js, 
Node.js, MongoDB and deployed on AWS EC2.

## 🌐 Live Demo
> Coming soon — deploying on AWS EC2

## ✨ Features

### 👤 Customer
- OTP-based email registration & forgot password
- Browse restaurants with real-time open/closed status
- Multi-restaurant cart with persistent storage
- Smart promo codes (specific item discounts + auto-apply daily deals)
- Loyalty points system (Bronze → Silver → Gold → Platinum)
- Schedule delivery for a specific date & time
- Real-time order tracking with live status updates (Socket.io)
- In-app notifications with unread badge

### 🏪 Restaurant Owner
- Dashboard with live order notifications (no page refresh needed)
- Update order status in real-time
- Menu management with image uploads
- Create daily promo codes for customers
- Reply to customer reviews
- Set opening hours & weekly off days

### 👨‍💼 Admin
- Manage all users (activate/deactivate)
- Manage all restaurants
- View all orders platform-wide
- Create global promo codes

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React.js, React Router, Axios |
| Backend | Node.js, Express.js |
| Database | MongoDB, Mongoose |
| Real-time | Socket.io |
| Auth | JWT + OTP Email Verification |
| Email | Nodemailer (Gmail) |
| Deployment | AWS EC2, Nginx, PM2 |

## 🚀 Run Locally

### Backend
```bash
cd backend
npm install
# create .env file with your MongoDB URI, JWT secret, Gmail credentials
npm start
```

### Frontend
```bash
cd frontend
npm install
npm start
```

## 📁 Project Structure
```
food-ordering-app/
├── backend/
│   ├── controllers/    # Business logic
│   ├── models/         # MongoDB schemas
│   ├── routes/         # API endpoints
│   ├── middleware/      # Auth middleware
│   └── utils/          # Email service
└── frontend/
    └── src/
        ├── pages/      # All page components
        ├── context/    # Auth & Cart context
        └── components/ # Navbar, Footer
```

## 🔐 Environment Variables
Create `backend/.env`:
```
PORT=8000
MONGODB_URI=mongodb://localhost:27017/food_ordering_db
JWT_SECRET=your_secret_here
CLIENT_URL=http://localhost:3000
EMAIL_USER=your@gmail.com
EMAIL_PASS=your_app_password
```

---
> Built with AI-assisted development (Claude AI) — 
> reflecting modern developer workflow
