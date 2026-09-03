import { NavLink, Outlet } from 'react-router-dom';

const VOCI_NAV = [
  { to: '/', label: 'Home', icona: '🏠', end: true },
  { to: '/misurazioni', label: 'Misure', icona: '📏' },
  { to: '/allenamenti', label: 'Workout', icona: '🏋️' },
  { to: '/esercizi', label: 'Esercizi', icona: '📈' },
  { to: '/profilo', label: 'Profilo', icona: '👤' },
];

export default function Layout() {
  return (
    <div className="app-shell">
      <nav className="app-nav" aria-label="Navigazione principale">
        {VOCI_NAV.map((voce) => (
          <NavLink
            key={voce.to}
            to={voce.to}
            end={voce.end}
            className={({ isActive }) => `app-nav__link${isActive ? ' app-nav__link--attivo' : ''}`}
          >
            <span className="app-nav__icona" aria-hidden="true">
              {voce.icona}
            </span>
            <span className="app-nav__label">{voce.label}</span>
          </NavLink>
        ))}
      </nav>
      <main className="app-content">
        <Outlet />
      </main>
    </div>
  );
}
