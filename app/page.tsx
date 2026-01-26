"use client";

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from './context/UserContext';
import { useFont } from './context/FontContext';
import { IoPersonOutline, IoAdd, IoCheckmark, IoCloseCircleOutline } from 'react-icons/io5';
import { subscribeToDailyLog, subscribeToRecipes, addFoodToLog, toggleFoodChecked, removeFoodFromLog } from './firebase/dataService';
import { DailyLog, LoggedFood, Recipe, MealType } from './types/user';

const ActivityRings = ({
  kcal,
  protein,
  fat,
  carbs,
  kcalTarget,
  proteinTarget,
  fatTarget,
  carbsTarget
}: {
  kcal: number;
  protein: number;
  fat: number;
  carbs: number;
  kcalTarget: number;
  proteinTarget: number;
  fatTarget: number;
  carbsTarget: number;
}) => {
  const ringSize = 90;
  const strokeWidth = 8;
  const radius = (ringSize - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;

  const rings = [
    {
      progress: Math.min(kcal / kcalTarget, 1),
      color: '#E4222A',
      backgroundColor: '#4A1C1E'
    },
    {
      progress: Math.min(protein / proteinTarget, 1),
      color: '#08B6DC',
      backgroundColor: '#16424C'
    },
    {
      progress: Math.min(fat / fatTarget, 1),
      color: '#F1A500',
      backgroundColor: '#4E4021'
    },
    {
      progress: Math.min(carbs / carbsTarget, 1),
      color: '#8DCF42',
      backgroundColor: '#323C28'
    },
  ];

  return (
    <div className="flex items-center justify-center">
      <svg width={ringSize} height={ringSize}>
        {rings.map((ring, index) => {
          const strokeDashoffset = circumference - (ring.progress * circumference);
          return (
            <g key={index}>
              <circle
                cx={ringSize / 2}
                cy={ringSize / 2}
                r={radius - (index * (strokeWidth + 2))}
                stroke={ring.backgroundColor}
                strokeWidth={strokeWidth}
                fill="none"
              />
              <circle
                cx={ringSize / 2}
                cy={ringSize / 2}
                r={radius - (index * (strokeWidth + 2))}
                stroke={ring.color}
                strokeWidth={strokeWidth}
                fill="none"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                transform={`rotate(-90 ${ringSize / 2} ${ringSize / 2})`}
              />
            </g>
          );
        })}
      </svg>
    </div>
  );
};

export default function HomeScreen() {
  const { macroTargets, authUser } = useUser();
  const { fontFamily, fontFamilyMedium, fontFamilySemiBold, fontFamilyBold } = useFont();
  const router = useRouter();
  const [weekOffset, setWeekOffset] = useState(0);
  const [selectedDayIndex, setSelectedDayIndex] = useState(-1);

  const [dailyLog, setDailyLog] = useState<DailyLog | null>(null);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [addFoodModalVisible, setAddFoodModalVisible] = useState(false);
  const [selectedMealType, setSelectedMealType] = useState<MealType>('breakfast');

  const [expandedMeals, setExpandedMeals] = useState<Set<MealType>>(new Set());

  const getSelectedDate = useCallback(() => {
    const today = new Date();
    if (selectedDayIndex === -1) return today;

    const dayOfWeek = today.getDay();
    const monday = new Date(today);
    monday.setDate(today.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1) + (weekOffset * 7));
    const selectedDate = new Date(monday);
    selectedDate.setDate(monday.getDate() + selectedDayIndex);
    return selectedDate;
  }, [selectedDayIndex, weekOffset]);

  useEffect(() => {
    if (!authUser) return;

    setIsLoading(true);
    const date = getSelectedDate();
    const unsubscribe = subscribeToDailyLog(authUser.uid, date, (log) => {
      setDailyLog(log);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [authUser, getSelectedDate]);

  useEffect(() => {
    if (!authUser) return;

    const unsubscribe = subscribeToRecipes(authUser.uid, (fetchedRecipes) => {
      setRecipes(fetchedRecipes);
    });

    return () => unsubscribe();
  }, [authUser]);

  const currentIntake = useMemo(() => dailyLog?.totals || {
    kcal: 0,
    protein: 0,
    fat: 0,
    carbs: 0,
  }, [dailyLog]);

  const kcalTarget = macroTargets ? macroTargets.kcal : 2000;
  const proteinTarget = macroTargets ? macroTargets.protein : 150;
  const fatTarget = macroTargets ? macroTargets.fat : 80;
  const carbsTarget = macroTargets ? macroTargets.carbs : 250;

  const remaining = useMemo(() => ({
    kcal: Math.max(0, kcalTarget - currentIntake.kcal),
    protein: Math.max(0, proteinTarget - currentIntake.protein),
    fat: Math.max(0, fatTarget - currentIntake.fat),
    carbs: Math.max(0, carbsTarget - currentIntake.carbs),
  }), [currentIntake, kcalTarget, proteinTarget, fatTarget, carbsTarget]);

  const getWeekDates = (offset: number) => {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const monday = new Date(today);
    monday.setDate(today.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1) + (offset * 7));

    const days = [];
    const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

    for (let i = 0; i < 7; i++) {
      const date = new Date(monday);
      date.setDate(monday.getDate() + i);
      const isToday = date.toDateString() === today.toDateString();
      days.push({
        dayName: dayNames[i],
        date: date.getDate(),
        isToday,
        fullDate: date,
      });
    }
    return days;
  };

  const weekDays = getWeekDates(weekOffset);
  const currentMonth = weekDays[3].fullDate.toLocaleString('default', { month: 'long', year: 'numeric' });

  const goToPreviousWeek = () => {
    setWeekOffset(prev => prev - 1);
    setSelectedDayIndex(3);
  };

  const goToNextWeek = () => {
    setWeekOffset(prev => prev + 1);
    setSelectedDayIndex(3);
  };

  const goToToday = () => {
    setWeekOffset(0);
    setSelectedDayIndex(-1);
  };

  const getFoodsByMealType = (mealType: MealType): LoggedFood[] => {
    if (!dailyLog) return [];
    return dailyLog.foods.filter(f => f.mealType === mealType);
  };

  const getMealData = (mealType: MealType) => {
    const foods = getFoodsByMealType(mealType);
    const checkedFoods = foods.filter(f => f.checked);
    const kcal = checkedFoods.reduce((sum, f) => sum + (f.kcal * f.servings), 0);
    return { foods, kcal, items: foods.length };
  };

  const meals: { id: MealType; name: string; icon: string }[] = [
    { id: 'breakfast', name: 'Breakfast', icon: '🍳' },
    { id: 'lunch', name: 'Lunch', icon: '🍜' },
    { id: 'dinner', name: 'Dinner', icon: '🍖' },
    { id: 'snacks', name: 'Snacks', icon: '🍎' },
  ];

  const handleAddRecipeToLog = async (recipe: Recipe) => {
    if (!authUser) return;

    await addFoodToLog(authUser.uid, getSelectedDate(), {
      type: 'recipe',
      sourceId: recipe.id,
      name: recipe.title,
      image: recipe.image,
      kcal: recipe.kcal,
      protein: recipe.protein,
      carbs: recipe.carbs,
      fat: recipe.fat,
      servings: 1,
      mealType: selectedMealType,
      checked: true,
    });

    setAddFoodModalVisible(false);
  };

  const handleToggleFood = async (foodId: string) => {
    if (!authUser) return;
    await toggleFoodChecked(authUser.uid, getSelectedDate(), foodId);
  };

  const handleRemoveFood = async (foodId: string) => {
    if (!authUser) return;
    await removeFoodFromLog(authUser.uid, getSelectedDate(), foodId);
  };

  const openAddFoodModal = (mealType: MealType) => {
    setSelectedMealType(mealType);
    setAddFoodModalVisible(true);
  };

  const toggleMealExpansion = (mealType: MealType) => {
    setExpandedMeals(prev => {
      const newSet = new Set(prev);
      if (newSet.has(mealType)) {
        newSet.delete(mealType);
      } else {
        newSet.add(mealType);
      }
      return newSet;
    });
  };

  const getTodayIndex = () => {
    const today = new Date();
    for (let i = 0; i < weekDays.length; i++) {
      if (weekDays[i].isToday) return i;
    }
    return -1;
  };

  const effectiveSelectedIndex = selectedDayIndex === -1 ? getTodayIndex() : selectedDayIndex;

  const today = new Date();
  const todayDateString = today.toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long' }).replace(/^\w/, c => c.toUpperCase());

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="flex justify-between items-center px-5 pt-20 pb-4" style={{backgroundColor: '#000000'}}>
        <div>
          <h1 className="text-2xl font-bold" style={{color: '#FFFFFF'}}>Overzicht</h1>
          <p className="text-sm mt-1" style={{color: '#CCCCCC'}}>{todayDateString}</p>
        </div>
        <button className="w-11 h-11 rounded-full flex items-center justify-center shadow-lg" style={{backgroundColor: '#1A1A1A', boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.06)'}} onClick={() => router.push('/settings')}>
          <IoPersonOutline size={24} color="#9CA3AF" />
        </button>
      </div>

      <div className="overflow-y-auto pb-20" style={{paddingHorizontal: 20}}>
        {/* Macros Section */}
        <div className="mb-6">
          <div className="rounded-xl p-5 mb-3" style={{backgroundColor: '#1A1A1A', borderRadius: 16, padding: 20, marginBottom: 12, boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.06)'}}>
            <div className="flex justify-between items-center mb-3">
              <span className="text-base font-semibold" style={{color: '#FF4400', marginBottom: 10}}>🔥 Activiteit</span>
            </div>
            <div className="flex items-baseline">
              <span className="text-3xl font-bold" style={{color: '#ffffff'}}>4,093</span>
              <span className="text-sm ml-1" style={{color: '#CCCCCC', fontWeight: '800'}}>stappen</span>
            </div>
          </div>
          <div className="rounded-xl p-5 shadow-lg" style={{backgroundColor: '#1A1A1A', borderRadius: 16, padding: 20, marginBottom: 12, boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.06)'}}>
            <div className="flex justify-between items-center mb-3">
              <span className="text-base font-semibold" style={{color: '#8DCF42'}}>🥗 Voeding</span>
            </div>
            <div className="flex items-baseline mb-4">
              <span className="text-3xl font-bold" style={{color: '#FFFFFF'}}>{Math.round(currentIntake.kcal)}</span>
              <span className="text-sm ml-1" style={{color: '#CCCCCC'}}>kcal</span>
            </div>
            <div className="w-full h-2 rounded mb-2 overflow-hidden" style={{backgroundColor: '#333333'}}>
              <div
                className="h-full rounded"
                style={{width: `${Math.min((currentIntake.kcal / kcalTarget) * 100, 100)}%`, backgroundColor: '#8DCF42'}}
              />
            </div>
            <p className="text-sm" style={{color: '#CCCCCC'}}>{remaining.kcal} kcal remaining</p>

            {/* Macros and Rings Row */}
            <div className="flex justify-between items-center mt-4">
              {/* Macros Row */}
              <div className="flex items-center">
                <div className="text-center mx-2">
                  <p className="text-sm font-semibold mb-2" style={{color: '#E4222A'}}>Eiwit</p>
                  <p className="text-lg font-bold">{Math.round(currentIntake.protein)}g</p>
                  <p className="text-xs text-gray-500">{remaining.protein}g</p>
                </div>
                <div className="w-px h-10 bg-gray-600 mx-1" />
                <div className="text-center mx-2">
                  <p className="text-sm font-semibold mb-2" style={{color: '#F1A500'}}>Vet</p>
                  <p className="text-lg font-bold">{Math.round(currentIntake.fat)}g</p>
                  <p className="text-xs text-gray-500">{remaining.fat}g</p>
                </div>
                <div className="w-px h-10 bg-gray-600 mx-1" />
                <div className="text-center mx-2">
                  <p className="text-sm font-semibold mb-2" style={{color: '#08B6DC'}}>Carbs</p>
                  <p className="text-lg font-bold">{Math.round(currentIntake.carbs)}g</p>
                  <p className="text-xs text-gray-500">{remaining.carbs}g</p>
                </div>
              </div>

              {/* Activity Rings */}
              <ActivityRings
                kcal={currentIntake.kcal}
                protein={currentIntake.protein}
                fat={currentIntake.fat}
                carbs={currentIntake.carbs}
                kcalTarget={kcalTarget}
                proteinTarget={proteinTarget}
                fatTarget={fatTarget}
                carbsTarget={carbsTarget}
              />
            </div>
          </div>
        </div>

        <div className="rounded-xl mb-6 shadow-lg overflow-hidden" style={{backgroundColor: '#1A1A1A', borderRadius: 16, paddingBottom: 16, boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.06)'}}>
          <h2 className="text-lg font-semibold px-5 pt-5 pb-2" style={{color: '#FFFFFF'}}>Maaltijden</h2>
          {meals.map((meal, index) => {
            const mealData = getMealData(meal.id);
            const hasItems = mealData.items > 0;
            const isExpanded = expandedMeals.has(meal.id);
            return (
              <div key={meal.id}>
                {isExpanded ? (
                  <div className="rounded-lg overflow-hidden cursor-pointer" style={{backgroundColor: '#2D2D2D', marginLeft: 20, marginRight: 20, marginTop: 16, borderRadius: 12}}>
                    <div className="flex items-center justify-between p-5" onClick={() => toggleMealExpansion(meal.id)}>
                      <div>
                        <p className="text-base font-semibold" style={{color: '#FFFFFF'}}>{meal.name}</p>
                        {hasItems ? (
                          <p className="text-sm mt-2" style={{color: '#8DCF42'}}>{Math.round(mealData.kcal)} kcal • {mealData.items} item{mealData.items > 1 ? 's' : ''}</p>
                        ) : (
                          <p className="text-sm mt-2" style={{color: '#AAAAAA'}}>No items yet</p>
                        )}
                      </div>
                      <button className="w-8 h-8 rounded-full flex items-center justify-center" style={{backgroundColor: '#4E4E4E'}} onClick={() => openAddFoodModal(meal.id)}>
                        <IoAdd size={20} color="#FFFFFF" />
                      </button>
                    </div>

                    {mealData.foods.length > 0 && (
                      <div className="px-3 pb-2">
                        {mealData.foods.map((food) => (
                          <div key={food.id} className="flex items-center rounded-lg p-3 mb-2 cursor-pointer" style={{backgroundColor: '#212121', borderRadius: 12, padding: 12, marginBottom: 8}} onClick={() => handleToggleFood(food.id)}>
                            <button
                              className="w-6 h-6 rounded-full flex items-center justify-center mr-3"
                              style={{borderWidth: 2, borderColor: food.checked ? '#10B981' : '#666666', backgroundColor: food.checked ? '#10B981' : 'transparent'}}
                              onClick={() => handleToggleFood(food.id)}
                            >
                              {food.checked && <IoCheckmark size={16} color="#FFF" />}
                            </button>
                            <div className="flex-1">
                              <p className="text-sm font-medium" style={{color: food.checked ? '#AAAAAA' : '#FFFFFF', textDecorationLine: food.checked ? 'line-through' : 'none'}}>{food.name}</p>
                              <p className="text-xs mt-2" style={{color: '#CCCCCC'}}>
                                {Math.round(food.kcal)} kcal • {food.type === 'food' && food.grams ? `${food.grams}g` : `${food.servings} serving${food.servings !== 1 ? 's' : ''}`}
                              </p>
                            </div>
                            <button onClick={() => handleRemoveFood(food.id)}>
                              <IoCloseCircleOutline size={20} color="#9CA3AF" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center justify-between px-5 py-4 cursor-pointer" onClick={() => toggleMealExpansion(meal.id)}>
                    <div>
                      <p className="text-base font-semibold" style={{color: '#FFFFFF'}}>{meal.name}</p>
                      {hasItems ? (
                        <p className="text-sm mt-2" style={{color: '#8DCF42'}}>{Math.round(mealData.kcal)} kcal • {mealData.items} item{mealData.items > 1 ? 's' : ''}</p>
                      ) : (
                        <p className="text-sm mt-2" style={{color: '#AAAAAA'}}>No items yet</p>
                      )}
                    </div>
                    <button className="w-8 h-8 rounded-full flex items-center justify-center" style={{backgroundColor: '#4E4E4E'}} onClick={() => openAddFoodModal(meal.id)}>
                      <IoAdd size={20} color="#FFFFFF" />
                    </button>
                  </div>
                )}

                {index < meals.length - 1 && <div className="h-px bg-gray-700 mx-5" />}
              </div>
            );
          })}
        </div>

        <div className="h-20" />
      </div>

      {/* Add Food Modal */}
      {addFoodModalVisible && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex justify-center items-center z-50">
          <div className="w-full max-w-md max-h-[80vh] rounded-3xl p-5 overflow-y-auto shadow-2xl" style={{backgroundColor: '#1A1A1A'}}>
            <div className="flex justify-between items-center mb-5">
              <h3 className="text-lg font-semibold" style={{color: '#FFFFFF'}}>Add to {selectedMealType.charAt(0).toUpperCase() + selectedMealType.slice(1)}</h3>
              <button onClick={() => setAddFoodModalVisible(false)}>
                <IoCloseCircleOutline size={24} color="#6B7280" />
              </button>
            </div>

            <div>
              <h4 className="text-sm font-semibold uppercase mb-3" style={{color: '#CCCCCC', letterSpacing: 0.5}}>Your Recipes</h4>
              {recipes.length === 0 ? (
                <p className="text-sm text-center py-5" style={{color: '#AAAAAA'}}>No recipes yet. Create one in the Recipes tab!</p>
              ) : (
                recipes.map((recipe) => (
                  <div key={recipe.id} className="flex items-center rounded-lg p-3 mb-3 shadow-lg cursor-pointer" style={{backgroundColor: '#2A2A2A', borderRadius: 12, padding: 12, marginBottom: 10}} onClick={() => handleAddRecipeToLog(recipe)}>
                    {recipe.image && (
                      <img src={recipe.image} alt={recipe.title} className="w-12 h-12 rounded-lg mr-3" style={{borderRadius: 8}} />
                    )}
                    <div className="flex-1">
                      <p className="text-sm font-medium" style={{color: '#FFFFFF'}}>{recipe.title}</p>
                      <p className="text-xs mt-2" style={{color: '#CCCCCC'}}>
                        {recipe.kcal} kcal • {recipe.protein}g protein
                      </p>
                    </div>
                    <IoAdd size={24} color="#4A90D9" />
                  </div>
                ))
              )}

              <h4 className="text-sm font-semibold uppercase mt-5 mb-3" style={{color: '#CCCCCC', letterSpacing: 0.5}}>Search Foods</h4>
              <p className="text-sm text-center py-5" style={{color: '#AAAAAA'}}>Go to the Food tab to search and add foods</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
