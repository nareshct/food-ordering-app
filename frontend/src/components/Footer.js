import React from 'react';
import { Link } from 'react-router-dom';
import './Footer.css';

const Footer = () => (
  <footer className="footer">
    <div className="container">
      <div className="footer-content">
        <div className="footer-section">
          <h3>🍔 FoodOrder</h3>
          <p>Your favourite food from the best restaurants, delivered fresh and fast to your doorstep.</p>
        </div>
        <div className="footer-section">
          <h4>Quick Links</h4>
          <ul>
            <li><Link to="/">🏠 Home</Link></li>
            <li><Link to="/restaurants">🍽️ Restaurants</Link></li>
            <li><Link to="/register">🚀 Sign Up</Link></li>
            <li><Link to="/login">🔑 Login</Link></li>
          </ul>
        </div>
        <div className="footer-section">
          <h4>Contact</h4>
          <div className="contact-item">📧 info@foodorder.com</div>
          <div className="contact-item">📞 +91 1234567890</div>
          <div className="contact-item">🕐 9 AM – 11 PM, Every Day</div>
        </div>
      </div>
      <div className="footer-bottom">
        <p>© 2026 FoodOrder. All rights reserved.</p>
        <p>Made with ❤️ for food lovers</p>
      </div>
    </div>
  </footer>
);

export default Footer;