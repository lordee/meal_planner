import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Calendar, Utensils, X, BookOpen, Search, Check, ExternalLink, ShoppingBasket, Sparkles } from 'lucide-react';

type Recipe = {
  id: string;
  name: string;
  description: string;
  imageUrl: string;
  recipeUrl?: string;
  ingredients?: string;
};

type Meal = {
  id: string;
  name: string;
  description: string;
  imageUrl: string;
  recipeUrl?: string;
  ingredients?: string;
};

type DayPlan = {
  day: string;
  meals: Meal[];
};

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const fallbackImages = [
  'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600&q=80',
  'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=600&q=80',
  'https://images.unsplash.com/photo-1476224489176-e8885876d19f?w=600&q=80',
  'https://images.unsplash.com/photo-1493770348161-369560ae357d?w=600&q=80'
];

export default function App() {
  const [plans, setPlans] = useState<DayPlan[]>(
    DAYS.map(day => ({ day, meals: [] }))
  );
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isRecipeManagerOpen, setIsRecipeManagerOpen] = useState(false);
  const [isShoppingListOpen, setIsShoppingListOpen] = useState(false);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [newMeal, setNewMeal] = useState({ name: '', description: '', recipeUrl: '', ingredients: '' });
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingMeal, setEditingMeal] = useState<{ day: string, originalDay: string, meal: Meal } | null>(null);
  const [editingRecipe, setEditingRecipe] = useState<Recipe | null>(null);
  const [isFormatting, setIsFormatting] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch('/api/meals').then(res => res.json()),
      fetch('/api/recipes').then(res => res.json())
    ])
      .then(([mealData, recipeData]) => {
        if (mealData.length > 0) setPlans(mealData);
        if (recipeData.length > 0) setRecipes(recipeData);
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to load data:', err);
        setLoading(false);
      });
  }, []);

  const saveToBackend = (updatedPlans: DayPlan[]) => {
    fetch('/api/meals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updatedPlans),
    });
  };

  const saveRecipesToBackend = (updatedRecipes: Recipe[]) => {
    fetch('/api/recipes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updatedRecipes),
    });
  };

  const formatIngredientsWithAI = async (ingredients: string, type: 'new' | 'meal' | 'recipe') => {
    if (!ingredients.trim()) return;
    setIsFormatting(true);

    // Capture IDs before async call to ensure we save to the right place even if modal closes
    const mealId = editingMeal?.meal.id;
    const mealName = editingMeal?.meal.name;
    const recipeId = editingRecipe?.id;
    const recipeName = editingRecipe?.name;

    try {
      const response = await fetch('/api/format-ingredients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ingredients }),
      });
      const data = await response.json();
      const formatted = data.formatted;

      if (formatted) {
        if (type === 'new') {
          setNewMeal(prev => ({ ...prev, ingredients: formatted }));
        } else if (type === 'meal' && mealId) {
          // 1. Update Plans
          const updatedPlans = plans.map(p => ({
            ...p,
            meals: p.meals.map(m => m.id === mealId ? { ...m, ingredients: formatted } : m)
          }));
          setPlans(updatedPlans);
          saveToBackend(updatedPlans);

          // 2. Sync to Recipes Library
          const updatedRecipes = recipes.map(r => 
            r.name.toLowerCase() === mealName?.toLowerCase() ? { ...r, ingredients: formatted } : r
          );
          setRecipes(updatedRecipes);
          saveRecipesToBackend(updatedRecipes);

          // 3. Update Modal state if still open
          setEditingMeal(prev => (prev && prev.meal.id === mealId) ? { ...prev, meal: { ...prev.meal, ingredients: formatted } } : prev);
        } else if (type === 'recipe' && recipeId) {
          // 1. Update Recipes Library
          const updatedRecipes = recipes.map(r => r.id === recipeId ? { ...r, ingredients: formatted } : r);
          setRecipes(updatedRecipes);
          saveRecipesToBackend(updatedRecipes);

          // 2. Sync back to Plans
          const updatedPlans = plans.map(p => ({
            ...p,
            meals: p.meals.map(m => m.name.toLowerCase() === recipeName?.toLowerCase() ? { ...m, ingredients: formatted } : m)
          }));
          setPlans(updatedPlans);
          saveToBackend(updatedPlans);

          // 3. Update Modal state if still open
          setEditingRecipe(prev => (prev && prev.id === recipeId) ? { ...prev, ingredients: formatted } : prev);
        }
      } else if (data.error) {
        alert(data.error);
      }
    } catch (err) {
      console.error('Formatting error:', err);
      alert('Failed to connect to formatting service.');
    } finally {
      setIsFormatting(false);
    }
  };

  const addMeal = (recipeData?: Recipe, targetDay?: string) => {
    const dayToUse = targetDay || selectedDay;
    if (!dayToUse) return;
    
    let mealToAdd: Meal;
    let updatedRecipes = [...recipes];

    if (recipeData) {
      mealToAdd = { ...recipeData, id: Math.random().toString(36).substr(2, 9) };
    } else {
      const name = newMeal.name.trim();
      if (!name) return;
      
      const existingRecipe = recipes.find(r => r.name.toLowerCase() === name.toLowerCase());
      
      if (existingRecipe) {
        mealToAdd = { ...existingRecipe, id: Math.random().toString(36).substr(2, 9) };
      } else {
        const query = encodeURIComponent(name.replace(/\s+/g, ','));
        const imageUrl = `https://loremflickr.com/600/400/food,meal,${query}/all`;
        const recipeId = Math.random().toString(36).substr(2, 9);
        
        mealToAdd = { 
          id: Math.random().toString(36).substr(2, 9), 
          name: name,
          description: newMeal.description, 
          imageUrl,
          recipeUrl: newMeal.recipeUrl,
          ingredients: newMeal.ingredients
        };

        const newRecipe = { id: recipeId, name: name, description: newMeal.description, imageUrl, recipeUrl: newMeal.recipeUrl, ingredients: newMeal.ingredients };
        updatedRecipes = [...recipes, newRecipe];
        setRecipes(updatedRecipes);
        saveRecipesToBackend(updatedRecipes);
      }
    }

    const updatedPlans = plans.map(p => {
      if (p.day === dayToUse) {
        return { ...p, meals: [...p.meals, mealToAdd] };
      }
      return p;
    });

    setPlans(updatedPlans);
    saveToBackend(updatedPlans);
    setNewMeal({ name: '', description: '', recipeUrl: '', ingredients: '' });
    setSearchQuery('');
    setIsModalOpen(false);
  };

  const addRecipe = () => {
    const name = newMeal.name.trim();
    if (!name) return;
    const query = encodeURIComponent(name.replace(/\s+/g, ','));
    const imageUrl = `https://loremflickr.com/600/400/food,meal,${query}/all`;
    const updatedRecipes = [
      ...recipes,
      { 
        id: Math.random().toString(36).substr(2, 9), 
        name: name, 
        description: newMeal.description, 
        imageUrl,
        recipeUrl: newMeal.recipeUrl,
        ingredients: newMeal.ingredients
      }
    ];
    setRecipes(updatedRecipes);
    saveRecipesToBackend(updatedRecipes);
    setNewMeal({ name: '', description: '', recipeUrl: '', ingredients: '' });
  };

  const removeRecipe = (id: string) => {
    const updatedRecipes = recipes.filter(r => r.id !== id);
    setRecipes(updatedRecipes);
    saveRecipesToBackend(updatedRecipes);
  };

  const removeMeal = (day: string, mealId: string) => {
    const updatedPlans = plans.map(p => {
      if (p.day === day) {
        return { ...p, meals: p.meals.filter(m => m.id !== mealId) };
      }
      return p;
    });
    setPlans(updatedPlans);
    saveToBackend(updatedPlans);
    if (editingMeal?.meal.id === mealId) {
      setEditingMeal(null);
    }
  };

  const updateMeal = (day: string, updatedMeal: Meal, newDay?: string) => {
    let updatedPlans = plans.map(p => {
      if (p.day === day) {
        return {
          ...p,
          meals: p.meals.filter(m => m.id !== updatedMeal.id)
        };
      }
      return p;
    });

    const targetDay = newDay || day;
    updatedPlans = updatedPlans.map(p => {
      if (p.day === targetDay) {
        return { ...p, meals: [...p.meals, updatedMeal] };
      }
      return p;
    });

    setPlans(updatedPlans);
    saveToBackend(updatedPlans);

    const updatedRecipes = recipes.map(r => {
      if (r.name.toLowerCase() === updatedMeal.name.toLowerCase()) {
        return { 
          ...r, 
          description: updatedMeal.description || '', 
          imageUrl: updatedMeal.imageUrl || '',
          recipeUrl: updatedMeal.recipeUrl || '',
          ingredients: updatedMeal.ingredients || ''
        };
      }
      return r;
    });
    setRecipes(updatedRecipes);
    saveRecipesToBackend(updatedRecipes);
    setEditingMeal(null);
  };

  const updateRecipe = (updatedRecipe: Recipe) => {
    const oldRecipe = recipes.find(r => r.id === updatedRecipe.id);
    if (!oldRecipe) return;

    const updatedRecipes = recipes.map(r => r.id === updatedRecipe.id ? updatedRecipe : r);
    setRecipes(updatedRecipes);
    saveRecipesToBackend(updatedRecipes);

    const updatedPlans = plans.map(p => ({
      ...p,
      meals: p.meals.map(m => {
        if (m.name.toLowerCase() === oldRecipe.name.toLowerCase()) {
          return { 
            ...m, 
            name: updatedRecipe.name, 
            description: updatedRecipe.description, 
            imageUrl: updatedRecipe.imageUrl,
            recipeUrl: updatedRecipe.recipeUrl,
            ingredients: updatedRecipe.ingredients
          };
        }
        return m;
      })
    }));
    setPlans(updatedPlans);
    saveToBackend(updatedPlans);
    setEditingRecipe(null);
  };

  const handleDragStartMeal = (e: React.DragEvent, day: string, meal: Meal) => {
    e.dataTransfer.setData('type', 'meal');
    e.dataTransfer.setData('mealId', meal.id);
    e.dataTransfer.setData('fromDay', day);
  };

  const handleDragStartRecipe = (e: React.DragEvent, recipe: Recipe) => {
    e.dataTransfer.setData('type', 'recipe');
    e.dataTransfer.setData('recipeId', recipe.id);
  };

  const handleDrop = (e: React.DragEvent, toDay: string) => {
    const type = e.dataTransfer.getData('type');
    
    if (type === 'meal') {
      const mealId = e.dataTransfer.getData('mealId');
      const fromDay = e.dataTransfer.getData('fromDay');
      if (fromDay === toDay) return;
      const fromDayPlan = plans.find(p => p.day === fromDay);
      const mealToMove = fromDayPlan?.meals.find(m => m.id === mealId);
      if (mealToMove) {
        updateMeal(fromDay, mealToMove, toDay);
      }
    } else if (type === 'recipe') {
      const recipeId = e.dataTransfer.getData('recipeId');
      const recipe = recipes.find(r => r.id === recipeId);
      if (recipe) {
        addMeal(recipe, toDay);
      }
    }
  };

  const getShoppingList = () => {
    const ingredientsMap: { [key: string]: { minQty: number, maxQty: number, unit: string, name: string } } = {};
    
    plans.forEach(day => {
      day.meals.forEach(meal => {
        if (meal.ingredients) {
          const lines = meal.ingredients.split('\n');
          lines.forEach(line => {
            const parts = line.split('|').map(p => p.trim());
            if (parts.length < 3) return;

            const qtyStr = parts[0];
            const unit = parts[1];
            const name = parts[2].toLowerCase();

            let min = 0;
            let max = 0;

            if (qtyStr.includes('-')) {
              const [s1, s2] = qtyStr.split('-').map(Number);
              min = isNaN(s1) ? 0 : s1;
              max = isNaN(s2) ? min : s2;
            } else {
              const val = parseFloat(qtyStr);
              min = isNaN(val) ? 1 : val;
              max = min;
            }

            const key = `${name}-${unit}`;
            if (ingredientsMap[key]) {
              ingredientsMap[key].minQty += min;
              ingredientsMap[key].maxQty += max;
            } else {
              ingredientsMap[key] = { minQty: min, maxQty: max, unit, name };
            }
          });
        }
      });
    });

    return Object.values(ingredientsMap);
  };

  const filteredRecipes = recipes.filter(r => 
    r.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 text-emerald-600">
      <Utensils size={48} className="animate-spin" />
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8 font-sans text-gray-900 flex flex-col">
      <header className="max-w-[1600px] mx-auto mb-12 flex justify-between items-end w-full">
        <div>
          <h1 className="text-4xl font-bold text-gray-900 tracking-tight">Weekly Feast</h1>
          <p className="text-gray-500 mt-2">Plan your culinary journey for the week.</p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={() => setIsShoppingListOpen(true)}
            className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-xl hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-200"
          >
            <ShoppingBasket size={20} />
            <span className="font-medium">Shopping List</span>
          </button>
          <button 
            onClick={() => setIsRecipeManagerOpen(true)}
            className="flex items-center gap-2 bg-white border border-gray-200 px-4 py-2 rounded-xl text-gray-700 hover:bg-gray-50 transition-colors shadow-sm"
          >
            <BookOpen size={20} />
            <span className="font-medium text-sm md:text-base">Recipe Library</span>
          </button>
        </div>
      </header>

      <div className="flex-1 flex flex-col lg:flex-row gap-8 max-w-[1600px] mx-auto w-full h-[calc(100vh-200px)] min-h-[600px]">
        {/* Sidebar: Recipe Library */}
        <aside className="w-full lg:w-80 flex flex-col gap-6 overflow-hidden bg-white/50 backdrop-blur rounded-3xl border border-gray-100 p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-900">Library</h2>
            <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Drag to day</div>
          </div>
          
          <div className="relative group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-emerald-500 transition-colors" size={18} />
            <input 
              type="text"
              placeholder="Search favorites..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white border border-gray-100 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all text-sm"
            />
          </div>

          <div className="flex-1 overflow-y-auto pr-1 space-y-3 custom-scrollbar">
            {recipes.length === 0 ? (
              <div className="text-center py-10 text-gray-400">
                <BookOpen size={32} className="mx-auto mb-2 opacity-10" />
                <p className="text-xs italic">No recipes yet.</p>
              </div>
            ) : (
              recipes.filter(r => r.name.toLowerCase().includes(searchQuery.toLowerCase())).map(recipe => (
                <div 
                  key={recipe.id}
                  draggable
                  onDragStart={(e) => handleDragStartRecipe(e, recipe)}
                  onClick={() => setEditingRecipe(recipe)}
                  className="group flex items-center gap-3 p-2 bg-white border border-gray-100 rounded-2xl hover:border-emerald-500 hover:shadow-md transition-all cursor-grab active:cursor-grabbing"
                >
                  <div className="w-12 h-12 rounded-xl overflow-hidden bg-gray-50 flex-shrink-0">
                    <img 
                      src={recipe.imageUrl} 
                      className="w-full h-full object-cover" 
                      onError={(e) => {
                        const hash = recipe.name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
                        e.currentTarget.src = fallbackImages[hash % fallbackImages.length];
                      }}
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4 className="font-bold text-xs truncate text-gray-800">{recipe.name}</h4>
                    <p className="text-[10px] text-gray-400 truncate">{recipe.description || 'No description'}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </aside>

        {/* Main: Weekly Planner Grid */}
        <main className="flex-1 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-4 h-full overflow-y-auto lg:overflow-visible">
          {plans.map((dayPlan) => (
            <div 
              key={dayPlan.day} 
              className="flex flex-col gap-4"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => handleDrop(e, dayPlan.day)}
            >
              <div className="flex justify-between items-center px-1">
                <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest">{dayPlan.day}</h2>
                <button 
                  onClick={() => { setSelectedDay(dayPlan.day); setIsModalOpen(true); setSearchQuery(''); setNewMeal({ name: '', description: '', recipeUrl: '', ingredients: '' }); }}
                  className="hover:bg-emerald-50 p-1.5 rounded-lg text-emerald-600 transition-colors bg-white border border-gray-100 shadow-sm"
                >
                  <Plus size={18} />
                </button>
              </div>
              
              <div className="flex flex-col gap-4 min-h-[100px] flex-1">
                {dayPlan.meals.length === 0 ? (
                  <div className="border-2 border-dashed border-gray-200 rounded-2xl flex-1 flex items-center justify-center text-gray-300 text-[10px] text-center px-2 py-8">
                    Drop here
                  </div>
                ) : (
                  dayPlan.meals.map((meal) => (
                    <div 
                      key={meal.id} 
                      draggable
                      onDragStart={(e) => handleDragStartMeal(e, dayPlan.day, meal)}
                      onClick={() => setEditingMeal({ day: dayPlan.day, originalDay: dayPlan.day, meal })}
                      className="group relative bg-white rounded-2xl shadow-sm hover:shadow-md transition-all overflow-hidden border border-gray-100 animate-in fade-in zoom-in duration-300 cursor-pointer active:cursor-grabbing"
                    >
                      <div className="relative h-24 bg-emerald-50">
                        <img 
                          src={meal.imageUrl} 
                          alt={meal.name} 
                          className="w-full h-full object-cover transition-opacity duration-500" 
                          onLoad={(e) => (e.currentTarget.style.opacity = '1')}
                          style={{ opacity: 0 }}
                          onError={(e) => {
                            const hash = meal.name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
                            e.currentTarget.src = fallbackImages[hash % fallbackImages.length];
                            e.currentTarget.style.opacity = '1';
                          }}
                        />
                        <button 
                          onClick={(e) => { e.stopPropagation(); removeMeal(dayPlan.day, meal.id); }}
                          className="absolute top-1 right-1 p-1 bg-black/50 text-white rounded-md opacity-0 group-hover:opacity-100 transition-all hover:bg-red-500 shadow-sm"
                          title="Remove from plan"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                      <div className="p-2">
                        <h3 className="font-bold text-[11px] truncate leading-tight">{meal.name}</h3>
                        {meal.recipeUrl && (
                          <div className="mt-1 text-[9px] text-emerald-600 font-semibold flex items-center gap-1">
                            <ExternalLink size={8} />
                            Recipe
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          ))}
        </main>
      </div>


      {/* Add Meal Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div className="p-6 border-b border-gray-50 flex justify-between items-center bg-gray-50/30">
              <div>
                <h3 className="text-xl font-bold text-gray-900">Add Meal</h3>
                <p className="text-xs text-gray-500">{selectedDay}</p>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-gray-100 rounded-xl transition-colors text-gray-400"><X size={20} /></button>
            </div>
            
            <div className="p-6 overflow-y-auto flex flex-col gap-6">
              <div className="relative">
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Meal Name</label>
                <div className="relative">
                  <input 
                    autoFocus
                    type="text" 
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setNewMeal(prev => ({ ...prev, name: e.target.value }));
                    }}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-emerald-500 focus:bg-white outline-none transition-all"
                    placeholder="Search favorites or type new..."
                  />
                  {searchQuery && (
                    <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-100 rounded-2xl shadow-2xl z-10 max-h-60 overflow-y-auto overflow-x-hidden p-2">
                      {filteredRecipes.length > 0 ? (
                        filteredRecipes.map(recipe => (
                          <button 
                            key={recipe.id}
                            onClick={() => {
                              setNewMeal({ name: recipe.name, description: recipe.description || '', recipeUrl: recipe.recipeUrl || '', ingredients: recipe.ingredients || '' });
                              setSearchQuery(recipe.name);
                              addMeal(recipe);
                            }}
                            className="w-full flex items-center gap-3 p-2 hover:bg-emerald-50 rounded-xl transition-colors text-left group"
                          >
                            <div className="w-12 h-12 rounded-lg overflow-hidden bg-emerald-50 flex-shrink-0">
                              <img 
                                src={recipe.imageUrl} 
                                className="w-full h-full object-cover" 
                                onError={(e) => {
                                  e.currentTarget.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(recipe.name)}&background=10b981&color=fff`;
                                }}
                              />
                            </div>
                            <div className="min-w-0 flex-1">
                              <h4 className="font-bold text-sm truncate group-hover:text-emerald-700 transition-colors">{recipe.name}</h4>
                              <p className="text-[11px] text-gray-400 truncate">{recipe.description}</p>
                            </div>
                            <Plus className="text-emerald-500 opacity-0 group-hover:opacity-100 transition-opacity" size={18} />
                          </button>
                        ))
                      ) : (
                        <div className="p-4 text-center">
                          <p className="text-xs text-emerald-600 font-medium">✨ Creating a new recipe!</p>
                          <p className="text-[10px] text-gray-400 mt-1">This will be added to your library automatically.</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Description (Optional)</label>
                <textarea 
                  value={newMeal.description}
                  onChange={(e) => setNewMeal({...newMeal, description: e.target.value})}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-emerald-500 focus:bg-white outline-none h-24 resize-none transition-all"
                  placeholder="Tell us about this dish..."
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Recipe URL (Optional)</label>
                <input 
                  type="text" 
                  value={newMeal.recipeUrl}
                  onChange={(e) => setNewMeal({...newMeal, recipeUrl: e.target.value})}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-emerald-500 focus:bg-white outline-none transition-all"
                  placeholder="https://..."
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider">Ingredients (Optional)</label>
                  <button 
                    onClick={() => formatIngredientsWithAI(newMeal.ingredients, 'new')}
                    disabled={isFormatting || !newMeal.ingredients.trim()}
                    className="text-[10px] font-bold text-emerald-600 hover:text-emerald-700 flex items-center gap-1 disabled:opacity-50 transition-opacity"
                  >
                    <Sparkles size={12} className={isFormatting ? "animate-pulse" : ""} />
                    {isFormatting ? 'Formatting...' : 'Magic Format'}
                  </button>
                </div>
                <textarea 
                  value={newMeal.ingredients}
                  onChange={(e) => setNewMeal({...newMeal, ingredients: e.target.value})}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-emerald-500 focus:bg-white outline-none h-32 resize-none transition-all"
                  placeholder="List ingredients here (e.g. 2 cups flour)..."
                />
              </div>

              <button 
                onClick={() => addMeal()}
                disabled={!searchQuery.trim()}
                className="w-full bg-emerald-600 text-white font-bold py-4 rounded-2xl hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200 disabled:bg-gray-200 disabled:shadow-none disabled:cursor-not-allowed transform active:scale-[0.98]"
              >
                Add to Plan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Recipe Library Modal */}
      {isRecipeManagerOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-40">
          <div className="bg-white rounded-3xl w-full max-w-5xl shadow-2xl overflow-hidden flex flex-col h-[85vh] animate-in zoom-in duration-300">
            <div className="p-6 border-b border-gray-50 flex justify-between items-center bg-gray-50/30">
              <div className="flex items-center gap-3">
                <BookOpen className="text-emerald-600" />
                <h3 className="text-2xl font-bold text-gray-900">Recipe Library</h3>
              </div>
              <button onClick={() => setIsRecipeManagerOpen(false)} className="p-2 hover:bg-gray-100 rounded-xl transition-colors text-gray-400"><X size={24} /></button>
            </div>
            
            <div className="flex flex-1 overflow-hidden">
              <div className="w-full md:w-80 p-8 border-r border-gray-50 bg-gray-50/20 overflow-y-auto hidden md:block">
                <h4 className="font-bold mb-6 text-gray-900">Quick Add</h4>
                <div className="flex flex-col gap-6">
                  <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Name</label>
                    <input 
                      type="text" 
                      value={newMeal.name}
                      onChange={(e) => setNewMeal({...newMeal, name: e.target.value})}
                      className="w-full px-4 py-3 bg-white border border-gray-100 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none shadow-sm"
                      placeholder="e.g. Smoothie Bowl"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Description</label>
                    <textarea 
                      value={newMeal.description}
                      onChange={(e) => setNewMeal({...newMeal, description: e.target.value})}
                      className="w-full px-4 py-3 bg-white border border-gray-100 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none h-32 resize-none shadow-sm"
                      placeholder="Add details..."
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Recipe URL</label>
                    <input 
                      type="text" 
                      value={newMeal.recipeUrl}
                      onChange={(e) => setNewMeal({...newMeal, recipeUrl: e.target.value})}
                      className="w-full px-4 py-3 bg-white border border-gray-100 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none shadow-sm"
                      placeholder="https://..."
                    />
                  </div>
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider">Ingredients</label>
                      <button 
                        onClick={() => formatIngredientsWithAI(newMeal.ingredients, 'new')}
                        disabled={isFormatting || !newMeal.ingredients.trim()}
                        className="text-[10px] font-bold text-emerald-600 hover:text-emerald-700 flex items-center gap-1 disabled:opacity-50 transition-opacity"
                      >
                        <Sparkles size={12} className={isFormatting ? "animate-pulse" : ""} />
                        Magic Format
                      </button>
                    </div>
                    <textarea 
                      value={newMeal.ingredients}
                      onChange={(e) => setNewMeal({...newMeal, ingredients: e.target.value})}
                      className="w-full px-4 py-3 bg-white border border-gray-100 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none h-32 resize-none shadow-sm"
                      placeholder="List ingredients here..."
                    />
                  </div>
                  <button 
                    onClick={addRecipe}
                    className="w-full bg-emerald-600 text-white font-bold py-4 rounded-2xl hover:bg-emerald-700 transition-all shadow-md active:scale-95"
                  >
                    Save to Library
                  </button>
                </div>
              </div>

              <div className="flex-1 flex flex-col overflow-hidden bg-white">
                <div className="p-6 border-b border-gray-50">
                  <div className="relative group">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-emerald-500 transition-colors" size={20} />
                    <input 
                      type="text"
                      placeholder="Search your collection..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-12 pr-6 py-4 bg-gray-50 border border-transparent rounded-2xl focus:ring-2 focus:ring-emerald-500 focus:bg-white outline-none transition-all"
                    />
                  </div>
                </div>
                <div className="p-8 overflow-y-auto flex-1 custom-scrollbar">
                  {recipes.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-gray-300">
                      <div className="w-24 h-24 bg-gray-50 rounded-full flex items-center justify-center mb-6">
                        <BookOpen size={40} className="opacity-20" />
                      </div>
                      <p className="font-medium">Your library is empty</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                      {recipes.filter(r => r.name.toLowerCase().includes(searchQuery.toLowerCase())).map(recipe => (
                        <div 
                          key={recipe.id} 
                          onClick={() => setEditingRecipe(recipe)}
                          className="group relative bg-white border border-gray-100 rounded-3xl overflow-hidden hover:shadow-xl transition-all hover:-translate-y-1 cursor-pointer"
                        >
                          <div className="relative h-40 bg-emerald-50">
                            <img 
                              src={recipe.imageUrl} 
                              className="w-full h-full object-cover transition-opacity duration-500" 
                              onLoad={(e) => (e.currentTarget.style.opacity = '1')}
                              style={{ opacity: 0 }}
                              onError={(e) => {
                                const hash = recipe.name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
                                e.currentTarget.src = fallbackImages[hash % fallbackImages.length];
                                e.currentTarget.style.opacity = '1';
                              }}
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-4">
                              <p className="text-white text-xs font-medium line-clamp-2">{recipe.description}</p>
                            </div>
                          </div>
                          <div className="p-4 flex justify-between items-start">
                            <div className="min-w-0 flex-1">
                              <h4 className="font-bold text-gray-900 truncate">{recipe.name}</h4>
                            </div>
                            <button 
                              onClick={(e) => { e.stopPropagation(); removeRecipe(recipe.id); }}
                              className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all flex-shrink-0"
                            >
                              <Trash2 size={18} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Meal Modal */}
      {editingMeal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-gray-50 flex justify-between items-center bg-gray-50/30">
              <h3 className="text-xl font-bold text-gray-900">Edit Meal</h3>
              <button onClick={() => setEditingMeal(null)} className="p-2 hover:bg-gray-100 rounded-xl transition-colors text-gray-400"><X size={20} /></button>
            </div>
            
            <div className="p-6 overflow-y-auto flex flex-col gap-6">
              <div className="aspect-video w-full rounded-2xl overflow-hidden bg-gray-100 border border-gray-100 shadow-inner relative group/img">
                <img src={editingMeal.meal.imageUrl} className="w-full h-full object-cover" />
                {editingMeal.meal.recipeUrl && (
                  <a 
                    href={editingMeal.meal.recipeUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="absolute bottom-4 right-4 bg-white/90 backdrop-blur px-3 py-1.5 rounded-lg shadow-sm text-emerald-600 text-xs font-bold hover:bg-white transition-colors"
                  >
                    Open Original Recipe
                  </a>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Meal Name</label>
                <input 
                  type="text" 
                  value={editingMeal.meal.name}
                  onChange={(e) => setEditingMeal({...editingMeal, meal: {...editingMeal.meal, name: e.target.value}})}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-emerald-500 focus:bg-white outline-none transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Plan for Day</label>
                <select 
                  value={editingMeal.day}
                  onChange={(e) => setEditingMeal({...editingMeal, day: e.target.value})}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-emerald-500 focus:bg-white outline-none transition-all appearance-none"
                >
                  {DAYS.map(day => (
                    <option key={day} value={day}>{day}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Description</label>
                <textarea 
                  value={editingMeal.meal.description}
                  onChange={(e) => setEditingMeal({...editingMeal, meal: {...editingMeal.meal, description: e.target.value}})}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-emerald-500 focus:bg-white outline-none h-24 resize-none transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Recipe URL</label>
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    value={editingMeal.meal.recipeUrl || ''}
                    onChange={(e) => setEditingMeal({...editingMeal, meal: {...editingMeal.meal, recipeUrl: e.target.value}})}
                    className="flex-1 px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-emerald-500 focus:bg-white outline-none transition-all"
                    placeholder="https://..."
                  />
                  {editingMeal.meal.recipeUrl && (
                    <a 
                      href={editingMeal.meal.recipeUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-3 bg-gray-50 border border-gray-100 rounded-2xl text-emerald-600 hover:bg-emerald-50 transition-colors"
                    >
                      <ExternalLink size={20} />
                    </a>
                  )}
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider">Ingredients</label>
                  <button 
                    onClick={() => formatIngredientsWithAI(editingMeal.meal.ingredients || '', 'meal')}
                    disabled={isFormatting || !(editingMeal.meal.ingredients || '').trim()}
                    className="text-[10px] font-bold text-emerald-600 hover:text-emerald-700 flex items-center gap-1 disabled:opacity-50 transition-opacity"
                  >
                    <Sparkles size={12} className={isFormatting ? "animate-pulse" : ""} />
                    Magic Format
                  </button>
                </div>
                <textarea 
                  value={editingMeal.meal.ingredients || ''}
                  onChange={(e) => setEditingMeal({...editingMeal, meal: {...editingMeal.meal, ingredients: e.target.value}})}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-emerald-500 focus:bg-white outline-none h-32 resize-none transition-all"
                  placeholder="List ingredients here..."
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Image URL</label>
                <input 
                  type="text" 
                  value={editingMeal.meal.imageUrl}
                  onChange={(e) => setEditingMeal({...editingMeal, meal: {...editingMeal.meal, imageUrl: e.target.value}})}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-emerald-500 focus:bg-white outline-none transition-all"
                  placeholder="Paste a new image URL..."
                />
              </div>

              <div className="flex gap-3">
                <button 
                  onClick={() => removeMeal(editingMeal.originalDay, editingMeal.meal.id)}
                  className="flex-1 bg-red-50 text-red-600 font-bold py-4 rounded-2xl hover:bg-red-100 transition-all flex items-center justify-center gap-2"
                >
                  <Trash2 size={18} />
                  Delete
                </button>
                <button 
                  onClick={() => updateMeal(editingMeal.originalDay, editingMeal.meal, editingMeal.day)}
                  className="flex-[2] bg-emerald-600 text-white font-bold py-4 rounded-2xl hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200"
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Recipe Modal */}
      {editingRecipe && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[60]">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-gray-50 flex justify-between items-center bg-gray-50/30">
              <h3 className="text-xl font-bold text-gray-900">Edit Library Recipe</h3>
              <button onClick={() => setEditingRecipe(null)} className="p-2 hover:bg-gray-100 rounded-xl transition-colors text-gray-400"><X size={20} /></button>
            </div>
            
            <div className="p-6 overflow-y-auto flex flex-col gap-6">
              <div className="aspect-video w-full rounded-2xl overflow-hidden bg-gray-100 border border-gray-100 shadow-inner relative group/img">
                <img 
                  src={editingRecipe.imageUrl} 
                  className="w-full h-full object-cover" 
                  onError={(e) => {
                    const hash = editingRecipe.name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
                    e.currentTarget.src = fallbackImages[hash % fallbackImages.length];
                  }}
                />
                {editingRecipe.recipeUrl && (
                  <a 
                    href={editingRecipe.recipeUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="absolute bottom-4 right-4 bg-white/90 backdrop-blur px-3 py-1.5 rounded-lg shadow-sm text-emerald-600 text-xs font-bold hover:bg-white transition-colors"
                  >
                    Open Original Recipe
                  </a>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Recipe Name</label>
                <input 
                  type="text" 
                  value={editingRecipe.name}
                  onChange={(e) => setEditingRecipe({...editingRecipe, name: e.target.value})}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-emerald-500 focus:bg-white outline-none transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Description</label>
                <textarea 
                  value={editingRecipe.description}
                  onChange={(e) => setEditingRecipe({...editingRecipe, description: e.target.value})}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-emerald-500 focus:bg-white outline-none h-24 resize-none transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Recipe URL</label>
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    value={editingRecipe.recipeUrl || ''}
                    onChange={(e) => setEditingRecipe({...editingRecipe, recipeUrl: e.target.value})}
                    className="flex-1 px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-emerald-500 focus:bg-white outline-none transition-all"
                    placeholder="https://..."
                  />
                  {editingRecipe.recipeUrl && (
                    <a 
                      href={editingRecipe.recipeUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-3 bg-gray-50 border border-gray-100 rounded-2xl text-emerald-600 hover:bg-emerald-50 transition-colors"
                    >
                      <ExternalLink size={20} />
                    </a>
                  )}
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider">Ingredients</label>
                  <button 
                    onClick={() => formatIngredientsWithAI(editingRecipe.ingredients || '', 'recipe')}
                    disabled={isFormatting || !(editingRecipe.ingredients || '').trim()}
                    className="text-[10px] font-bold text-emerald-600 hover:text-emerald-700 flex items-center gap-1 disabled:opacity-50 transition-opacity"
                  >
                    <Sparkles size={12} className={isFormatting ? "animate-pulse" : ""} />
                    Magic Format
                  </button>
                </div>
                <textarea 
                  value={editingRecipe.ingredients || ''}
                  onChange={(e) => setEditingRecipe({...editingRecipe, ingredients: e.target.value})}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-emerald-500 focus:bg-white outline-none h-32 resize-none transition-all"
                  placeholder="List ingredients here..."
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Image URL</label>
                <input 
                  type="text" 
                  value={editingRecipe.imageUrl}
                  onChange={(e) => setEditingRecipe({...editingRecipe, imageUrl: e.target.value})}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-emerald-500 focus:bg-white outline-none transition-all"
                  placeholder="Paste a new image URL..."
                />
              </div>

              <div className="flex gap-3">
                <button 
                  onClick={() => { removeRecipe(editingRecipe.id); setEditingRecipe(null); }}
                  className="flex-1 bg-red-50 text-red-600 font-bold py-4 rounded-2xl hover:bg-red-100 transition-all flex items-center justify-center gap-2"
                >
                  <Trash2 size={18} />
                  Delete
                </button>
                <button 
                  onClick={() => updateRecipe(editingRecipe)}
                  className="flex-[2] bg-emerald-600 text-white font-bold py-4 rounded-2xl hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200"
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Shopping List Modal */}
      {isShoppingListOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[70]">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col max-h-[80vh] animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-gray-50 flex justify-between items-center bg-emerald-50/50">
              <div className="flex items-center gap-2 text-emerald-700">
                <ShoppingBasket size={24} />
                <h3 className="text-xl font-bold">Weekly Shopping List</h3>
              </div>
              <button onClick={() => setIsShoppingListOpen(false)} className="p-2 hover:bg-white rounded-xl transition-colors text-gray-400"><X size={20} /></button>
            </div>
            
            <div className="p-6 overflow-y-auto flex flex-col gap-4">
              {getShoppingList().length === 0 ? (
                <div className="text-center py-10 text-gray-400">
                  <ShoppingBasket size={48} className="mx-auto mb-4 opacity-10" />
                  <p>No ingredients found for this week.</p>
                  <p className="text-xs">Add ingredients to your meals to see them here.</p>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {getShoppingList().map((item: any, i) => (
                    <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100">
                      <span className="font-medium text-gray-700 capitalize">{item.name}</span>
                      <span className="bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full text-xs font-bold">
                        {item.minQty === item.maxQty 
                          ? (item.minQty % 1 === 0 ? item.minQty : item.minQty.toFixed(2)) 
                          : `${item.minQty % 1 === 0 ? item.minQty : item.minQty.toFixed(1)}-${item.maxQty % 1 === 0 ? item.maxQty : item.maxQty.toFixed(1)}`} {item.unit}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            <div className="p-6 border-t border-gray-50 bg-gray-50/30">
              <button 
                onClick={() => window.print()}
                className="w-full bg-white border border-gray-200 text-gray-700 font-bold py-3 rounded-2xl hover:bg-gray-100 transition-all shadow-sm flex items-center justify-center gap-2"
              >
                Print List
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
