# Security Notes for Mordecai

## 🔒 Critical Security Guidelines

### Environment Variables (.env file)

**❌ NEVER DO:**
- Commit `.env` files to Git
- Share `.env` files in public repositories
- Include real credentials in documentation
- Use production credentials in development
- Store credentials in plain text files

**✅ ALWAYS DO:**
- Add `.env` to `.gitignore`
- Use different credentials for each environment
- Use strong, unique passwords and secrets
- Rotate credentials regularly
- Use environment-specific Firebase projects

### Firebase Security

**🔥 Firebase Credentials:**
- Never expose Firebase service account keys publicly
- Use different Firebase projects for dev/staging/production
- Regularly rotate service account keys
- Use minimal required permissions for service accounts
- Enable Firebase Security Rules

**📋 Service Account Best Practices:**
```json
// ❌ DON'T: Use project owner accounts
{
  "role": "roles/owner"
}

// ✅ DO: Use minimal required permissions
{
  "role": "roles/firebase.admin"
}
```

### JWT Security

**🔑 JWT Secret:**
- Use cryptographically strong secrets (64+ characters)
- Different secrets for each environment
- Never hardcode secrets in source code
- Use environment variables only

**Generate Strong JWT Secret:**
```bash
# Generate a strong secret
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# Or use OpenSSL
openssl rand -hex 64
```

### Database Security

**🗄️ PostgreSQL:**
- Use strong passwords (12+ characters, mixed case, numbers, symbols)
- Create dedicated database users with minimal privileges
- Use SSL connections in production
- Regular database backups
- Monitor database access logs

**Example Secure Database Setup:**
```sql
-- Create user with limited privileges
CREATE USER mordecai_app WITH PASSWORD 'very-strong-password-here';

-- Grant only necessary permissions
GRANT CONNECT ON DATABASE mordecai_db TO mordecai_app;
GRANT USAGE ON SCHEMA public TO mordecai_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO mordecai_app;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO mordecai_app;
```

### Production Environment

**🚀 Production Checklist:**

- [ ] Change all default passwords
- [ ] Use production Firebase project
- [ ] Enable HTTPS/SSL
- [ ] Set specific CORS origins
- [ ] Use strong JWT secrets
- [ ] Enable database SSL
- [ ] Set up monitoring and logging
- [ ] Regular security updates
- [ ] Backup strategy in place

**Production .env Example:**
```env
NODE_ENV=production
DB_LOGGING=false
CORS_ORIGIN=https://yourdomain.com,https://www.yourdomain.com
JWT_SECRET=your-super-strong-production-secret-64-chars-minimum
FIREBASE_PROJECT_ID=mordecai-production
# ... other production values
```

### Git Security

**📝 .gitignore Requirements:**
```gitignore
# Environment variables
.env
.env.local
.env.production
.env.staging

# Firebase
firebase-adminsdk-*.json
serviceAccountKey.json

# Logs
*.log
logs/

# Database
*.db
*.sqlite

# OS
.DS_Store
Thumbs.db
```

### Monitoring and Alerts

**📊 Security Monitoring:**
- Monitor failed login attempts
- Alert on unusual database access
- Log all authentication events
- Monitor API rate limits
- Track Firebase usage

**Example Security Logging:**
```javascript
// Log security events
logger.warn({
  event: 'failed_login',
  email: email,
  ip: req.ip,
  attempts: user.loginAttempts
}, 'Failed login attempt');
```

### Regular Security Tasks

**🔄 Monthly:**
- Review access logs
- Update dependencies
- Check for security advisories
- Rotate JWT secrets

**🔄 Quarterly:**
- Rotate Firebase service account keys
- Update database passwords
- Security audit
- Backup testing

### Emergency Response

**🚨 If Credentials Are Compromised:**

1. **Immediately:**
   - Revoke compromised Firebase keys
   - Change database passwords
   - Rotate JWT secrets
   - Check access logs

2. **Within 24 hours:**
   - Generate new credentials
   - Update all environments
   - Notify team members
   - Document incident

3. **Follow-up:**
   - Review security practices
   - Update documentation
   - Implement additional monitoring

### Security Resources

**📚 Additional Reading:**
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Firebase Security Rules](https://firebase.google.com/docs/rules)
- [Node.js Security Best Practices](https://nodejs.org/en/docs/guides/security/)
- [PostgreSQL Security](https://www.postgresql.org/docs/current/security.html)

### Contact

**🆘 Security Issues:**
If you discover a security vulnerability in Mordecai, please report it immediately to the development team.

---

**Remember: Security is everyone's responsibility! 🛡️**
