# Quick Start Guide - Authentication & Meeting Scheduling

## What Was Added

✅ **User Authentication**
- Email-based login
- Google OAuth support
- JWT tokens

✅ **Admin System**
- Secure admin login with key (default: `1234`)
- Admin dashboard for managing meeting requests

✅ **Meeting Request System**
- Users can request meetings
- Admin can approve/reject requests
- Automatic email notifications

✅ **Database**
- MongoDB integration
- User and meeting request collections

## Quick Setup (5 minutes)

### 1. Update Environment Variables

Edit `.env.local` and add/update these lines:

```env
MONGODB_URI=mongodb://localhost:27017/translate-test
JWT_SECRET=change-this-to-random-string-in-production
ADMIN_KEY=1234
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=noreply@translateapp.com
```

### 2. Install MongoDB

**Windows/Mac/Linux:**
- Download from https://www.mongodb.com/try/download/community
- Or use Docker: `docker run -d -p 27017:27017 --name mongodb mongo`

### 3. Install Dependencies

```bash
pnpm install
```

### 4. Start the Application

```bash
./start-cloudflare.cmd
# or
./start-local.cmd
```

## Test the Features

### User Registration & Login
1. Open: `http://localhost:22042/login`
2. Enter name and email
3. Click "Sign In"
4. You're logged in!

### Request a Meeting
1. Click "Request New Meeting"
2. Fill in topic and description
3. Submit
4. Admin gets email notification

### Admin Panel
1. Open: `http://localhost:22042/admin/login`
2. Enter key: `1234`
3. Click "Login as Admin"
4. See all meeting requests
5. Click "Approve" to schedule a meeting
6. User gets email with meeting link

## Key Files Created

### Backend (API Server)
- `src/db/connection.ts` - MongoDB connection
- `src/db/models/user.ts` - User schema
- `src/db/models/meetingRequest.ts` - Meeting schema
- `src/lib/auth.ts` - JWT and password utilities
- `src/lib/email.ts` - Email notifications
- `src/middlewares/auth.ts` - Authentication middleware
- `src/routes/auth.ts` - Authentication endpoints
- `src/routes/meetings.ts` - Meeting request endpoints

### Frontend (UI)
- `src/stores/authStore.ts` - Authentication state management
- `src/pages/user-login.tsx` - User login page
- `src/pages/admin-login.tsx` - Admin login page
- `src/pages/user-dashboard.tsx` - User dashboard
- `src/pages/admin-dashboard.tsx` - Admin dashboard

## Test Credentials

**User Login:**
- Any email and name work (auto-registers on first login)

**Admin Login:**
- Key: `1234`

## Features Explained

### User Dashboard
- View all your meeting requests
- Request new meetings
- See approval status
- Receive meeting link and scheduled time via email
- View rejection reasons

### Admin Dashboard
- Filter requests by status
- View user details
- Approve meetings (schedule date/time)
- Reject meetings (provide reason)
- See statistics

### Email Notifications
- User receives email when admin approves
- User receives email when admin rejects
- Admin receives email when user requests

## Security

⚠️ **Important for Production:**
1. Change `ADMIN_KEY` from `1234` to something secure
2. Change `JWT_SECRET` to a random string
3. Use HTTPS (not HTTP)
4. Enable rate limiting
5. Secure your MongoDB connection

## Troubleshooting

**Q: MongoDB not connecting?**
- Make sure MongoDB is running: `mongosh`
- Check MONGODB_URI in .env.local
- For Atlas, check IP whitelist

**Q: Emails not sending?**
- Check SMTP credentials
- For Gmail, use app-specific password
- Check firewall/antivirus

**Q: Can't login?**
- Clear browser storage: DevTools → Application → Storage → Clear All
- Check .env.local has JWT_SECRET
- Ensure API server is running

**Q: Routes not working?**
- Restart servers
- Check API_BASE_URL matches your API port
- Look at browser console for errors

## Next Steps

1. **Customize**
   - Change ADMIN_KEY to your secret
   - Update email templates
   - Modify UI colors and branding

2. **Deploy**
   - Use provided Cloudflare tunnel
   - Or deploy to your server
   - Remember to update environment variables

3. **Enhance**
   - Add calendar integration
   - Implement meeting recording
   - Add reminder emails
   - Support multiple timezones

## Documentation

For detailed information:
- See `AUTHENTICATION_SETUP.md` for complete setup guide
- See API endpoint examples in setup guide
- Check database schema documentation

## Need Help?

1. Check AUTHENTICATION_SETUP.md
2. Review error messages in console
3. Check MongoDB is running
4. Verify environment variables
5. Look at API response in browser DevTools

---

**That's it! You now have a complete authentication and meeting scheduling system.** 🎉

Visit:
- **User Login:** http://localhost:22042/login
- **Admin Panel:** http://localhost:22042/admin/login
- **Video Calls:** http://localhost:22042/call
