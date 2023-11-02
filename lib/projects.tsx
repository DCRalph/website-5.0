type project = {
  title: string
  imgSrc: string
  code: string
  projectLink: string
  tech: string[]
  description: string
  modalContent: JSX.Element
}

const projects: project[] = [
  {
    title: 'Cards Against Humanity',
    imgSrc: '/project-imgs/cah.webp',
    code: 'https://github.com/DCRalph/game2',
    projectLink: 'https://game.williamgiles.co.nz',
    tech: [
      'nodejs',
      'express',
      'socket.io',
      'javascript',
      'html',
      'tailwindcss',
    ],
    description:
      'A web app for playing Cards Against Humanity online with friends.',
    modalContent: (
      <>
        <h2> What it is </h2>
        <p>
          I made a web app for playing Cards Against Humanity online with
          friends. It&rsquo;s a simple web app that uses websockets to
          communicate between players. It&rsquo;s a fun game to play with
          friends and I wanted to make it easier to play online. The web app was
          designed in a way where I can add more games in the future. I plan to
          add more games in the future.
        </p>
        <h2>How it works</h2>
        <p>
          The backend is a Express JS server that uses websockets to communicate
          with the frontend. The frontend is plain HTML, CSS and JS. The games
          are stored in a directory and the server loads them dynamically. The
          server also loads the game&rsquo;s assets dynamically. Each game has a
          backend file and frontend files. The backend file is used to handle
          the game logic and the frontend files contain the HTML, CSS and client
          side JS for the game. The server also has a lobby system where players
          can create and join lobbies. The lobbies are used to keep track of the
          players and the game state.
        </p>
        <h2>How I did it</h2>
        <p>
          I used Express JS for the backend and plain HTML, CSS and JS for the
          frontend. I used websockets to communicate between the frontend and
          backend. I used socket.io for the websockets. I created my own wrapper
          around socket.io to make it easier to use. It takes advantage of rooms
          for each lobby. Its not the the most secure because it sends out the
          game state to all the players. This means that players can cheat by
          looking at the game state. I plan to fix this in the future. My
          thinking was it most likely won&rsquo;t be a problem because the
          players are plaing on mobile devices whitch make it harder to look at
          the game state.
        </p>
        <h2>What I learned</h2>
        <p>I learned how to use websockets and how to use socket.io.</p>
      </>
    ),
  },
  {
    title: 'PID Simulator',
    imgSrc: '/project-imgs/pid-sim.webp',
    projectLink: '/pid-sim/index.html',
    code: '',
    tech: ['javascript', 'html', 'css', 'chart.js', 'tailwindcss'],
    description: 'A web app for simulating a PID controller.',
    modalContent: <p>A web app for simulating a PID controller.</p>,
  },
  {
    title: 'Portfolio',
    imgSrc: '/project-imgs/new-website.png',
    projectLink: 'https://williamgiles.co.nz',
    code: 'https://github.com/DCRalph/website-5.0',
    tech: ['nextjs', 'typescript', 'tailwindcss'],
    description: 'My portfolio website.',
    modalContent: (
      <>
        <p className="text-lg font-semibold">
          Recently decided to redesign and revamp my site. I had a few main
          goals:
        </p>
        <ul>
          <li>Make it easier to update</li>
          <li>Make it easier to add new projects</li>
          <li>Simplified, minimal design</li>
          <li>Make it faster</li>
        </ul>

        <p className="text-lg font-semibold">What I used</p>
        <ul>
          <li>Next.js for the frontend</li>
          <li>Vercel for hosting</li>
          <li>MDX for posts(comming soon)</li>
          <li>Content Layer for content management(comming soon)</li>
          <li>Tailwind CSS for styling</li>
          <li>Framer Motion for animations</li>
          <li>Prism for code highlighting(comming soon)</li>
          <li>And custom components for everything else</li>
        </ul>
      </>
    ),
  },
]

export default projects
export { projects }
