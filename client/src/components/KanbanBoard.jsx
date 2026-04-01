import React, { useState, useEffect, useMemo } from 'react';
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  defaultDropAnimationSideEffects,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { useSortable } from '@dnd-kit/sortable';
import { useDroppable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { MoreVertical, Plus, Clock, AlertCircle, CheckCircle2, User } from 'lucide-react';
import api from '../configs/api';
import { useAuth } from '@clerk/clerk-react';
import { useDispatch } from 'react-redux';
import { updateTask as updateTaskAction } from '../features/workspaceSlice';
import toast from 'react-hot-toast';

const STATUSES = ['TODO', 'IN_PROGRESS', 'DONE'];

const statusLabels = {
  TODO: 'To Do',
  IN_PROGRESS: 'In Progress',
  DONE: 'Completed',
};

const statusIcons = {
  TODO: <Clock className="size-4 text-zinc-500" />,
  IN_PROGRESS: <AlertCircle className="size-4 text-amber-500" />,
  DONE: <CheckCircle2 className="size-4 text-emerald-500" />,
};

const priorityColors = {
  LOW: 'border-blue-500/30 text-blue-600 bg-blue-50 dark:bg-blue-900/20 dark:text-blue-400',
  MEDIUM: 'border-amber-500/30 text-amber-600 bg-amber-50 dark:bg-amber-900/20 dark:text-amber-400',
  HIGH: 'border-red-500/30 text-red-600 bg-red-50 dark:bg-red-900/20 dark:text-red-400',
};

const SortableTask = ({ task }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: task.id,
    data: {
      type: 'task',
      task,
    }
  });

  const style = {
    transition,
    transform: CSS.Translate.toString(transform),
  };

  if (isDragging) {
    return (
      <div
        ref={setNodeRef}
        style={style}
        className="opacity-40 bg-zinc-100 dark:bg-zinc-800 rounded-xl border-2 border-dashed border-zinc-300 dark:border-zinc-700 h-[110px]"
      />
    );
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`group relative bg-white dark:bg-zinc-800 p-4 rounded-xl border border-zinc-200 dark:border-zinc-700/80 shadow-xs hover:shadow-md transition-shadow cursor-pointer active:cursor-grabbing mb-3`}
    >
      <div className="flex justify-between items-start mb-2">
        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-sm border border-zinc-100 dark:border-zinc-700 uppercase tracking-tighter ${priorityColors[task.priority]}`}>
          {task.priority}
        </span>
        <button className="opacity-0 group-hover:opacity-100 p-1 -mt-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-opacity">
          <MoreVertical className="size-3 text-zinc-400" />
        </button>
      </div>
      <h4 className="text-sm font-semibold text-zinc-800 dark:text-zinc-100 mb-2 line-clamp-2 leading-tight">
        {task.title}
      </h4>
      <div className="flex items-center justify-between mt-3">
        <div className="flex items-center gap-1">
          <div className="size-5 rounded-full overflow-hidden bg-zinc-100 dark:bg-zinc-700 flex items-center justify-center border border-zinc-200 dark:border-zinc-600">
            {task.assignee?.image ? (
              <img src={task.assignee.image} alt="Avatar" className="size-full object-cover" />
            ) : (
              <User className="size-3 text-zinc-400" />
            )}
          </div>
          <span className="text-[10px] text-zinc-500 truncate max-w-[80px]">
            {task.assignee?.name?.split(' ')[0] || 'Unassigned'}
          </span>
        </div>
        <div className="text-[10px] text-zinc-400 font-mono">
          {new Date(task.due_date).toLocaleDateString([], { month: 'short', day: 'numeric' })}
        </div>
      </div>
    </div>
  );
};

const KanbanColumn = ({ status, tasks, children }) => {
  const { setNodeRef, isOver } = useDroppable({
    id: status,
    data: {
      type: 'column',
      status,
    },
  });

  return (
    <div key={status} ref={setNodeRef} className={`flex-1 flex flex-col bg-zinc-50/70 dark:bg-zinc-900/40 rounded-2xl border border-zinc-200/60 dark:border-zinc-800/80 p-4 transition-colors ${isOver ? 'bg-zinc-100 dark:bg-zinc-800/40 border-zinc-300 dark:border-zinc-700' : ''}`}>
      <div className="flex items-center justify-between mb-5 px-1">
        <div className="flex items-center gap-2">
          <div className="p-1 px-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-800 shadow-xs">
            {statusIcons[status]}
          </div>
          <h3 className="font-bold text-xs uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
            {statusLabels[status]}
          </h3>
          <span className="ml-1 px-2 py-0.5 rounded-full bg-zinc-200/50 dark:bg-zinc-800/50 text-[10px] font-black text-zinc-400">
            {tasks.length}
          </span>
        </div>
        <button className="p-1.5 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-400 transition-all">
          <Plus className="size-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto pr-1 -mr-1 custom-scrollbar min-h-[300px]">
        <SortableContext
          id={status}
          items={tasks.map(t => t.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="pb-8 space-y-3">
            {children}
          </div>
        </SortableContext>
      </div>
    </div>
  );
};

export default function KanbanBoard({ initialTasks, projectId }) {
  const [tasks, setTasks] = useState(initialTasks || []);
  const [activeTask, setActiveTask] = useState(null);
  const { getToken } = useAuth();
  const dispatch = useDispatch();

  useEffect(() => {
    if (initialTasks) setTasks(initialTasks);
  }, [initialTasks]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const getTasksByStatus = (status) => {
    return tasks
      .filter((t) => t.status === status)
      .sort((a, b) => (a.position || 0) - (b.position || 0));
  };

  const handleDragStart = (event) => {
    const { active } = event;
    setActiveTask(tasks.find(t => t.id === active.id));
  };

  const handleDragOver = (event) => {
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id;
    const overId = over.id;

    if (activeId === overId) return;

    const activeTask = tasks.find(t => t.id === activeId);
    if (!activeTask) return;

    const isOverAColumn = STATUSES.includes(overId);

    if (isOverAColumn) {
      if (activeTask.status !== overId) {
        setTasks((prev) => {
          const index = prev.findIndex(t => t.id === activeId);
          const updated = [...prev];
          updated[index] = { ...activeTask, status: overId };
          return updated;
        });
      }
      return;
    }

    const overTask = tasks.find(t => t.id === overId);
    if (overTask && activeTask.status !== overTask.status) {
      setTasks((prev) => {
        const activeIndex = prev.findIndex(t => t.id === activeId);
        const overIndex = prev.findIndex(t => t.id === overId);
        const updated = [...prev];
        updated[activeIndex] = { ...activeTask, status: overTask.status };
        return arrayMove(updated, activeIndex, overIndex);
      });
    } else if (overTask) {
      setTasks((prev) => {
        const activeIndex = prev.findIndex(t => t.id === activeId);
        const overIndex = prev.findIndex(t => t.id === overId);
        return arrayMove(prev, activeIndex, overIndex);
      });
    }
  };

  const handleDragEnd = async (event) => {
    const { active, over } = event;
    setActiveTask(null);

    if (!over) return;

    const activeId = active.id;
    const activeTask = tasks.find(t => t.id === activeId);

    if (!activeTask) return;

    try {
      const token = await getToken();
      const columnTasks = tasks.filter(t => t.status === activeTask.status);
      const newPosition = columnTasks.findIndex(t => t.id === activeId);

      const { data } = await api.put(`/api/tasks/${activeId}`,
        {
          status: activeTask.status,
          position: newPosition
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      dispatch(updateTaskAction(data.task));
    } catch (error) {
      console.error(error);
      toast.error("Failed to save changes");
      setTasks(initialTasks);
    }
  };

  return (
    <div className="flex flex-col md:flex-row gap-6 h-[calc(100vh-280px)] min-h-[600px] select-none">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        {STATUSES.map((status) => (
          <KanbanColumn key={status} status={status} tasks={getTasksByStatus(status)}>
            {getTasksByStatus(status).map((task) => (
              <SortableTask key={task.id} task={task} />
            ))}
          </KanbanColumn>
        ))}

        <DragOverlay adjustScale={false} dropAnimation={defaultDropAnimationSideEffects({ styles: { active: { opacity: '0.4' } } })}>
          {activeTask ? (
            <div className="rotate-3 scale-105 pointer-events-none shadow-2xl opacity-90">
              <SortableTask task={activeTask} />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
