"use client";

import React, { createContext, useContext, useEffect, useReducer } from 'react';
import type { TodoItem, TodoStatus } from '@/types';
import { matchTodoUpdate } from './todoParser';

interface TodoState {
    todos: TodoItem[];
}

type TodoAction =
    | { type: 'ADD'; text: string; phase?: TodoItem['phase']; priority?: TodoItem['priority'] }
    | { type: 'TOGGLE'; id: string }
    | { type: 'UPDATE_FROM_AGENT'; todos: TodoItem[] }
    | { type: 'SET'; todos: TodoItem[] }
    | { type: 'DELETE'; id: string };

const initialState: TodoState = {
    todos: [],
};

const TodoContext = createContext<{
    state: TodoState;
    dispatch: React.Dispatch<TodoAction>;
} | null>(null);

const STORAGE_KEY = 'agentic-flow-todos-v1';

function todoReducer(state: TodoState, action: TodoAction): TodoState {
    switch (action.type) {
        case 'ADD':
            return {
                ...state,
                todos: [
                    ...state.todos,
                    {
                        id: Date.now().toString(),
                        text: action.text,
                        status: 'pending',
                        phase: action.phase || 'PLAN',
                        priority: action.priority || 'medium',
                        createdAt: Date.now(),
                        updatedAt: Date.now(),
                    },
                ],
            };

        case 'TOGGLE':
            return {
                ...state,
                todos: state.todos.map((todo) =>
                    todo.id === action.id
                        ? {
                              ...todo,
                              status:
                                  todo.status === 'complete'
                                      ? 'pending'
                                      : 'complete',
                              updatedAt: Date.now(),
                          }
                        : todo
                ),
            };

        case 'DELETE':
            return {
                ...state,
                todos: state.todos.filter((t) => t.id !== action.id),
            };

        case 'SET':
            return {
                ...state,
                todos: action.todos,
            };

        case 'UPDATE_FROM_AGENT': {
            // Intelligent Merge
            const newTodos = [...state.todos];
            const incomingTodos = action.todos;

            incomingTodos.forEach((incoming) => {
                const match = matchTodoUpdate(incoming.text, newTodos);

                if (match && match.confidence > 0.85) {
                    // Update existing
                    const index = newTodos.findIndex(
                        (t) => t.id === match.todo.id
                    );
                    if (index !== -1) {
                        const existing = newTodos[index];
                        // Merge fields - prioritize agent's view of status?
                        // If we are feeding the context correctly, agent's view should be accurate.
                        // However, we preserve the ID and creation time.
                        newTodos[index] = {
                            ...existing,
                            text: incoming.text, // Correct typos or rephrasing
                            status: incoming.status,
                            phase: incoming.phase,
                            updatedAt: Date.now(),
                        };
                    }
                } else {
                    // Add new
                    // Check if we already have one with same text to avoid dupes (matchTodoUpdate handles fuzzy, but exact check is cheap)
                    if (!newTodos.find(t => t.text === incoming.text)) {
                         newTodos.push(incoming);
                    }
                }
            });

            return {
                ...state,
                todos: newTodos,
            };
        }

        default:
            return state;
    }
}

export function TodoProvider({ children }: { children: React.ReactNode }) {
    const [state, dispatch] = useReducer(todoReducer, initialState);
    const [isLoaded, setIsLoaded] = React.useState(false);

    // Load from local storage on mount
    useEffect(() => {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored) {
                try {
                    const parsed = JSON.parse(stored);
                    if (Array.isArray(parsed)) {
                        dispatch({ type: 'SET', todos: parsed });
                    }
                } catch (e) {
                    console.error('Failed to parse todos from local storage', e);
                }
            }
        } catch {
            // ignore storage errors
        }
        setIsLoaded(true);
    }, []);

    // Save to local storage on change
    useEffect(() => {
        if (isLoaded) {
            try {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(state.todos));
            } catch {
                // ignore storage errors
            }
        }
    }, [state.todos, isLoaded]);

    return (
        <TodoContext.Provider value={{ state, dispatch }}>
            {children}
        </TodoContext.Provider>
    );
}

export function useTodoContext() {
    const context = useContext(TodoContext);
    if (!context) {
        throw new Error('useTodoContext must be used within a TodoProvider');
    }
    return context;
}
