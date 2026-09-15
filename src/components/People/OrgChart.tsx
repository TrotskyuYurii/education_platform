import React, { useMemo, useState } from 'react';
import { ChevronRight, ChevronDown, UserRound } from 'lucide-react';
import { OrgChartNode } from './types';

interface OrgChartProps {
  nodes: OrgChartNode[];
  onSelectEmployee: (userId: string) => void;
}

interface TreeNode extends OrgChartNode {
  children: TreeNode[];
}

const buildTree = (nodes: OrgChartNode[]): TreeNode[] => {
  const byId = new Map<string, TreeNode>();
  nodes.forEach(n => byId.set(n.id, { ...n, children: [] }));

  const roots: TreeNode[] = [];
  byId.forEach(node => {
    const managerId = node.managerId ? String(node.managerId) : null;
    if (managerId && byId.has(managerId) && managerId !== node.id) {
      byId.get(managerId)!.children.push(node);
    } else {
      roots.push(node);
    }
  });
  return roots;
};

const TreeItem: React.FC<{ node: TreeNode; depth: number; onSelectEmployee: (id: string) => void }> = ({
  node, depth, onSelectEmployee
}) => {
  const [isExpanded, setIsExpanded] = useState(depth < 1);
  const hasChildren = node.children.length > 0;

  return (
    <div>
      <div
        className="flex items-center gap-1.5 py-1.5 rounded-lg hover:bg-slate-50 cursor-pointer group"
        style={{ paddingLeft: `${depth * 20}px` }}
        onClick={() => onSelectEmployee(node.id)}
      >
        <button
          type="button"
          onClick={e => { e.stopPropagation(); setIsExpanded(prev => !prev); }}
          className={`w-5 h-5 flex items-center justify-center text-slate-400 hover:text-slate-700 shrink-0 ${hasChildren ? '' : 'invisible'}`}
        >
          {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
        </button>
        <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold shrink-0 overflow-hidden">
          {node.avatarUrl ? (
            <img src={node.avatarUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            node.fullName?.charAt(0).toUpperCase() || <UserRound className="w-3.5 h-3.5" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-slate-900 truncate group-hover:text-blue-600 transition">
            {node.fullName || 'Без імені'}
          </div>
          <div className="text-[11px] text-slate-500 truncate">
            {[node.positionTitle, node.departmentName].filter(Boolean).join(' · ') || '—'}
          </div>
        </div>
        {hasChildren && (
          <span className="text-[10px] text-slate-400 font-medium shrink-0 pr-2">{node.children.length}</span>
        )}
      </div>
      {isExpanded && hasChildren && (
        <div>
          {node.children.map(child => (
            <TreeItem key={child.id} node={child} depth={depth + 1} onSelectEmployee={onSelectEmployee} />
          ))}
        </div>
      )}
    </div>
  );
};

export const OrgChart: React.FC<OrgChartProps> = ({ nodes, onSelectEmployee }) => {
  const tree = useMemo(() => buildTree(nodes), [nodes]);

  if (nodes.length === 0) {
    return <div className="text-sm text-slate-400 text-center py-10">Дані для побудови оргструктури відсутні.</div>;
  }

  return (
    <div className="space-y-0.5">
      {tree.map(root => (
        <TreeItem key={root.id} node={root} depth={0} onSelectEmployee={onSelectEmployee} />
      ))}
    </div>
  );
};
