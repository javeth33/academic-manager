/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import Login from './components/Login';
import AdminDashboard from './components/AdminDashboard';
import ProfessorDashboard from './components/ProfessorDashboard';
import StudentDashboard from './components/StudentDashboard';

export default function App() {
  const [user, setUser] = useState<any>(null);

  if (!user) {
    return <Login onLogin={setUser} />;
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <nav className="bg-white border-b border-blue-100 px-8 py-4 flex justify-between items-center sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold">
            A
          </div>
          <span className="font-bold text-blue-900">Academic Blue</span>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-medium text-slate-900">{user.name}</p>
            <p className="text-xs text-slate-500 capitalize">{user.role}</p>
          </div>
          <button 
            onClick={() => setUser(null)}
            className="text-sm text-red-500 hover:text-red-700 font-medium"
          >
            Cerrar Sesión
          </button>
        </div>
      </nav>

      <main>
        {user.role === 'admin' && <AdminDashboard />}
        {user.role === 'professor' && <ProfessorDashboard user={user} />}
        {user.role === 'student' && <StudentDashboard user={user} />}
      </main>
    </div>
  );
}

