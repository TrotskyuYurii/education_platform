import React from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell 
} from 'recharts';
import { Target } from 'lucide-react';
import { DepartmentScoreStat, ReadProgressStats } from './types';

interface AnalyticsChartsProps {
  scoreByDept: DepartmentScoreStat[];
  readProgress: ReadProgressStats;
  totalSectionsCount: number;
}

/**
 * Найдорожчий вузол дашборда: три SVG-графіки recharts. Пропси приходять з
 * useMemo батька, тож будь-яка стороння зміна стану — відкриття сертифіката,
 * перемикання співробітника — більше не перемальовує графіки заново.
 */
export const AnalyticsCharts = React.memo<AnalyticsChartsProps>(({
  scoreByDept,
  readProgress,
  totalSectionsCount,
}) => {
  const pieData = [
    { name: 'Опрацьовано', value: readProgress.read },
    { name: 'Залишилось', value: readProgress.unread }
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      
      {/* Avg score by department BarChart */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs lg:col-span-2">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-base font-bold text-slate-900">Середній бал за підрозділами (%)</h3>
            <p className="text-xs text-slate-500 mt-0.5">Результати тестів співробітника за напрямками</p>
          </div>
          {scoreByDept.length > 0 && (
            <span className="text-xs font-semibold px-2.5 py-1 bg-purple-50 text-purple-700 rounded-lg">
              {scoreByDept.length} {scoreByDept.length === 1 ? 'підрозділ' : 'підрозділи(-ів)'}
            </span>
          )}
        </div>

        {scoreByDept.length > 0 ? (
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={scoreByDept} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} />
                <YAxis domain={[0, 100]} axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} />
                <Tooltip 
                  cursor={{fill: '#f1f5f9'}}
                  contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}}
                  formatter={(value: any) => [`${value}%`, 'Середній бал']}
                />
                <Legend iconType="circle" />
                <Bar dataKey="avgScore" name="Середній бал" fill="#8b5cf6" radius={[4, 4, 0, 0]} maxBarSize={50} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="h-[300px] flex flex-col items-center justify-center text-slate-400 text-sm border border-dashed border-slate-200 rounded-xl">
            <Target className="w-8 h-8 text-slate-300 mb-2" />
            <span>Немає завершених тестувань для розрахунку статистики</span>
          </div>
        )}
      </div>

      {/* Progress Donut Chart */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs">
        <h3 className="text-base font-bold text-slate-900 mb-1">Прогрес читання інструкцій</h3>
        <p className="text-xs text-slate-500 mb-6">Відсоток опрацьованих регламентів</p>
        
        <div className="h-[230px] w-full relative">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                innerRadius={70}
                outerRadius={90}
                paddingAngle={5}
                dataKey="value"
                stroke="none"
              >
                <Cell fill="#10b981" />
                <Cell fill="#f1f5f9" />
              </Pie>
              <Tooltip 
                contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className="text-3xl font-bold text-slate-900">{readProgress.percentage}%</span>
            <span className="text-xs text-slate-500 uppercase tracking-wider font-semibold mt-1">Опрацьовано</span>
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-around text-center text-xs">
          <div>
            <div className="font-bold text-emerald-600 text-base">{readProgress.read}</div>
            <div className="text-slate-500">Прочитано</div>
          </div>
          <div className="w-px h-8 bg-slate-100" />
          <div>
            <div className="font-bold text-slate-400 text-base">{readProgress.unread}</div>
            <div className="text-slate-500">Залишилось</div>
          </div>
          <div className="w-px h-8 bg-slate-100" />
          <div>
            <div className="font-bold text-slate-800 text-base">{totalSectionsCount}</div>
            <div className="text-slate-500">Всього в базі</div>
          </div>
        </div>
      </div>

    </div>
  );
});
AnalyticsCharts.displayName = 'AnalyticsCharts';
