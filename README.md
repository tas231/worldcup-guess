# World Cup Guess 🏆

A fun, interactive, and beautifully designed web application for running a football (soccer) tipping/prediction pool among friends or an office! 

Built with **React**, **Vite**, **Tailwind CSS**, and **Express/Node.js**, this application features live match syncing, AI-powered insights, dynamic event systems, and a competitive leaderboard.

## Features ✨

- ⚽ **Live Match Syncing:** Automatically updates match statuses, scores, and brackets.
- 🔮 **AI Insights & The Oracle:** Integrated with Google Gemini to provide hilarious office-specific football predictions, "Tip Buddies" analysis (finding your tipping soulmates or arch-nemeses), and daily "Hot Takes".
- 🥇 **Department & Global Leaderboards:** Track scores individually and collectively as a department/team.
- 🃏 **Strategic Jokers:** Users get a "Joker" for each tournament phase to double their points on a high-confidence match!
- 🍦 **Dynamic Special Events:** Admins can launch "Flash Events" (like Double Jokers) or "Ice Cream Sprints" (bounties for specific matches) directly from the admin panel to spice up the tournament!
- 📱 **Beautiful UI:** Built with modern Glassmorphism, Tailwind CSS, and Recharts for trajectory visualizations.

## Acknowledgements 🙏

A massive thank you to [Reza Rahiminia's World Cup 2026 API](https://github.com/rezarahiminia/worldcup2026) for providing the amazing external live match data! This app relies on this fantastic open-source API to seamlessly fetch and update live tournament games. 

Alternatively, if you are running a local or custom tournament (e.g. U9 club tournament, European Cup), the app also fully supports **self-added custom games and matches** via the Admin Dashboard! Simply toggle off "Enable External API Sync".

## Tech Stack 🛠️

- **Frontend:** React (Vite), Tailwind CSS, Recharts, Lucide React
- **Backend:** Node.js, Express, SQLite3
- **AI:** Google Generative AI SDK (Gemini 3.1 Flash Lite)
- **Deployment:** Ready for Google Cloud Run (Dockerless Buildpacks)

## Setup & Local Development 🚀

The easiest way to run the application locally is using Docker Compose.

1. **Clone the repository:**
   ```bash
   git clone https://github.com/tas231/worldcup-guess.git
   cd worldcup-guess
   ```

3. **Set up Environment Variables (Optional):**
   ```bash
   cp .env.example .env
   ```

4. **Start the Application:**
   ```bash
   docker-compose up --build
   ```
   The frontend will be available at `http://localhost:8080` and the backend at `http://localhost:3001`.

5. **(Optional) Seed Demo Data:**
   If you want to populate the database with example users, teams, and matches to test things out:
   ```bash
   cd server
   npm install
   npm run seed
   ```
   *(Demo users: `alice@example.com`, `bob@example.com`, `charlie@example.com` - Password for all is `password123`)*

*(Alternatively, you can run the client and server manually using `npm install` and `npm run dev` in their respective directories.)*

## Admin Configuration ⚙️

When you start the application for the first time, a default admin account is automatically created. 
- **Email:** `admin@worldcup.local`
- **Password:** `admin123`

Log in with this account to access the Admin Dashboard. From there, you can promote your *real* personal account to an Admin, and then you can safely delete the default `admin@worldcup.local` account.

In the Admin Dashboard, you can also:
- Input your **Google Gemini API Key** and **Football API Key** directly on the web.
- Manage users (reset passwords, change teams, promote admins).
- Wipe or Sync the database.
- Launch dynamic Flash Events (Ice Cream Sprint).
- Generate a formatted Slack/Teams Digest to share the latest results with your office.

## License 📜

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
