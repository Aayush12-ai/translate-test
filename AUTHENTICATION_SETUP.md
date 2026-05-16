# Authentication and Meeting Flow Setup

This project now supports:

- User authentication with MongoDB-backed accounts
- Email/password login for users
- Optional Google OAuth login for users
- Admin login with a special key
- Meeting requests from users
- Admin approval or rejection of those requests
- Auto-generated video call links when a meeting is approved
- Email notifications to the user and the admin

## What Uses MongoDB

MongoDB stores:

- Users
- Meeting requests

The user collection supports:

- `email`
- `name`
- `passwordHash`
- `googleId`
- `profilePicture`
- `isAdmin`

The meeting request collection supports:

- `userId`
- `userEmail`
- `userName`
- `topic`
- `description`
- `status`
- `scheduledAt`
- `meetingLink`
- `hostMeetingLink`
- `rejectionReason`

## Environment Variables

Update `.env.local` with values like these:

```env
# Database
DATABASE_URL=postgresql://username:password@host:5432/database?sslmode=require
MONGODB_URI=mongodb://localhost:27017/translate-test

# Ports
API_PORT=18080
WEB_PORT=22042

# Auth
JWT_SECRET=replace-this-with-a-strong-secret
ADMIN_KEY=1234
ADMIN_EMAIL=your-admin-email@gmail.com

# Google OAuth for user login
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_CALLBACK_URL=http://localhost:18080/api/auth/google/callback

# Email
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=noreply@translateapp.com

# URLs
API_BASE_URL=http://localhost:18080
FRONTEND_URL=http://localhost:22042
```

Notes:

- `ADMIN_KEY=1234` is fine for local/demo use only.
- `ADMIN_EMAIL` is where the admin host meeting link will be emailed.
- `FRONTEND_URL` should match the URL users open in the browser.
- Google OAuth is optional. Email/password login still works without it.

## Google OAuth Setup

To enable Google sign-in for users:

1. Create OAuth credentials in Google Cloud Console.
2. Add this redirect URI:

```text
http://localhost:18080/api/auth/google/callback
```

3. Put the client ID and secret into `.env.local`.

If Google OAuth is not configured, the login page still works with email and password.

## Email Setup

Email is used for:

- New meeting request notification to admin
- Approved meeting notification to user
- Approved meeting host link notification to admin
- Rejected meeting notification to user

For Gmail:

1. Turn on 2-factor authentication.
2. Generate an app password.
3. Use that app password as `SMTP_PASS`.

## User Flow

### 1. User account login

Users can:

- Sign up with `name + email + password`
- Log in with `email + password`
- Log in with Google if OAuth is configured

The login page is:

```text
/login
```

### 2. User requests a meeting

After login, the user dashboard lets the user submit:

- Meeting topic
- Meeting description

That request is saved in MongoDB and shown in the admin dashboard.

### 3. User sees status updates

The user dashboard shows:

- Pending requests
- Approved requests
- Rejected requests
- Scheduled date/time
- The generated join link after approval

## Admin Flow

### 1. Admin login

The admin logs in at:

```text
/admin/login
```

Using:

- Admin key: `1234` by default

Only admin-authenticated users can access the admin dashboard and approval routes.

### 2. Admin reviews requests

The admin dashboard shows:

- Pending requests
- Approved requests
- Rejected requests
- User name and email
- Requested topic and description

### 3. Admin schedules a meeting

When the admin approves a request:

- The admin picks the meeting date/time
- A secure user meeting link is generated
- A secure admin host link is generated
- The approved request is updated in MongoDB
- The user sees the meeting link in their dashboard
- The user receives an approval email
- The admin receives the host link by email

### 4. Admin rejects a request

When the admin rejects a request:

- A rejection reason is saved
- The user sees the rejection reason in their dashboard
- The user receives a rejection email

## Main Routes

### Auth

- `POST /api/auth/signup`
- `POST /api/auth/login`
- `POST /api/auth/admin/login`
- `GET /api/auth/google`
- `GET /api/auth/google/callback`
- `GET /api/auth/me`

### Meetings

- `POST /api/meetings/request`
- `GET /api/meetings/my-requests`
- `GET /api/meetings/all-requests`
- `POST /api/meetings/:id/approve`
- `POST /api/meetings/:id/reject`
- `GET /api/meetings/:id`

## Example Request Payloads

### User signup

```json
{
  "email": "user@example.com",
  "name": "Aayush",
  "password": "strongpassword123"
}
```

### User login

```json
{
  "email": "user@example.com",
  "password": "strongpassword123"
}
```

### Admin login

```json
{
  "key": "1234"
}
```

### Meeting request

```json
{
  "topic": "Account support call",
  "description": "I need help reviewing account options and documents."
}
```

### Approve request

```json
{
  "scheduledAt": "2026-05-20T14:00:00.000Z"
}
```

### Reject request

```json
{
  "rejectionReason": "Please choose another date and submit again."
}
```

## How to Run

From the project root:

```powershell
cd "c:\Users\AAyush\OneDrive\Desktop\crest\translate_test\translate-test"
.\start-local.cmd
```

Or, if you want the public Cloudflare URL too:

```powershell
cd "c:\Users\AAyush\OneDrive\Desktop\crest\translate_test\translate-test"
.\start-cloudflare.cmd
```

## Production Notes

Before deploying:

- Change `ADMIN_KEY`
- Change `JWT_SECRET`
- Set a real `ADMIN_EMAIL`
- Set real Google OAuth credentials
- Use a real MongoDB instance
- Use HTTPS
- Add rate limiting and logging/monitoring

## Current Behavior Summary

- Users authenticate against MongoDB-backed records.
- Admin access is controlled by the admin key plus admin-only JWT authorization.
- Meeting requests are stored in MongoDB.
- Approval generates a user join link and an admin host link.
- The admin dashboard now displays those generated links.
- The admin email receives the host link automatically when a meeting is approved.
