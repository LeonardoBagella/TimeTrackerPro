import React, { useState, useMemo, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useProjects } from "@/context/ProjectContext";
import { useUserRole } from "@/hooks/useUserRole";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { LogOut, Plus, Clock, Trash2, Calendar, AlertTriangle, TrendingUp, FileText, Settings } from "lucide-react";
import AddProjectDialog from "./AddProjectDialog";
import AddTimeDialog from "./AddTimeDialog";
import AdminReports from "./AdminReports";
import ProfileSettingsDialog from "./ProfileSettingsDialog";
import { calculateMissedEntries } from "@/utils/timeCalculations";
import {
  startOfMonth,
  endOfMonth,
  isWithinInterval,
  parseISO,
  eachDayOfInterval,
  isWeekend,
  subMonths,
} from "date-fns";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";

const Dashboard = () => {
  const { user, signOut } = useAuth();
  const { projects, timeEntries, deleteProject, deleteTimeEntry, isLoading } = useProjects();
  const { isProjectOwner, isAdmin } = useUserRole();
  const [showAddProject, setShowAddProject] = useState(false);
  const [showAddTime, setShowAddTime] = useState(false);
  const [prefilledDate, setPrefilledDate] = useState<string | undefined>(undefined);
  const [prefilledProjectId, setPrefilledProjectId] = useState<string | undefined>(undefined);
  const [showPreviousMonth, setShowPreviousMonth] = useState(false);
  const [showAdminReports, setShowAdminReports] = useState(false);
  const [showProfileSettings, setShowProfileSettings] = useState(false);
  const [displayName, setDisplayName] = useState<string | null>(null);

  useEffect(() => {
    const fetchDisplayName = async () => {
      if (!user) return;
      const { data } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("user_id", user.id)
        .single();
      if (data?.display_name) {
        setDisplayName(data.display_name);
      }
    };
    fetchDisplayName();
  }, [user]);

  // Filter time entries for current month
  const currentMonthStart = startOfMonth(new Date());
  const currentMonthEnd = endOfMonth(new Date());

  const currentMonthEntries = useMemo(() => {
    return timeEntries.filter((entry) => {
      const entryDate = parseISO(entry.date);
      return isWithinInterval(entryDate, { start: currentMonthStart, end: currentMonthEnd });
    });
  }, [timeEntries, currentMonthStart, currentMonthEnd]);

  // Calculate hours for current month only
  const totalUserHours = useMemo(() => {
    return currentMonthEntries.reduce((sum, entry) => sum + Number(entry.hours), 0);
  }, [currentMonthEntries]);

  const totalProjectHours = useMemo(() => {
    return projects.reduce((sum, project) => sum + (project.totalHours || 0), 0);
  }, [projects]);

  const recentEntries = timeEntries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 5);

  // Calculate working days for current month (entire month)
  const workingDaysData = useMemo(() => {
    const allDaysInMonth = eachDayOfInterval({
      start: currentMonthStart,
      end: currentMonthEnd,
    });

    const workingDays = allDaysInMonth.filter((day) => !isWeekend(day));
    const totalExpectedHours = workingDays.length * 8;
    const remainingHours = Math.max(0, totalExpectedHours - totalUserHours);

    console.log("Calcolo giorni lavorativi:", {
      inizio: currentMonthStart,
      fine: currentMonthEnd,
      giorniTotali: allDaysInMonth.length,
      giorniLavorativi: workingDays.length,
      oreAttese: totalExpectedHours,
      oreRendicontate: totalUserHours,
      oreMancanti: remainingHours,
    });

    return {
      chartData: [
        { name: "Ore Rendicontate", value: totalUserHours, color: "#10b981" },
        { name: "Ore Mancanti", value: remainingHours, color: "#9ca3af" },
      ],
      workingDaysCount: workingDays.length,
      totalExpectedHours,
    };
  }, [currentMonthStart, currentMonthEnd, totalUserHours]);

  // Calculate working days for previous month
  const previousMonthStart = startOfMonth(subMonths(new Date(), 1));
  const previousMonthEnd = endOfMonth(subMonths(new Date(), 1));

  const previousMonthEntries = useMemo(() => {
    return timeEntries.filter((entry) => {
      const entryDate = parseISO(entry.date);
      return isWithinInterval(entryDate, { start: previousMonthStart, end: previousMonthEnd });
    });
  }, [timeEntries, previousMonthStart, previousMonthEnd]);

  const totalPreviousMonthHours = useMemo(() => {
    return previousMonthEntries.reduce((sum, entry) => sum + Number(entry.hours), 0);
  }, [previousMonthEntries]);

  const previousMonthData = useMemo(() => {
    const allDaysInMonth = eachDayOfInterval({
      start: previousMonthStart,
      end: previousMonthEnd,
    });

    const workingDays = allDaysInMonth.filter((day) => !isWeekend(day));
    const totalExpectedHours = workingDays.length * 8;
    const remainingHours = Math.max(0, totalExpectedHours - totalPreviousMonthHours);

    return {
      chartData: [
        { name: "Ore Rendicontate", value: totalPreviousMonthHours, color: "#10b981" },
        { name: "Ore Mancanti", value: remainingHours, color: "#9ca3af" },
      ],
      workingDaysCount: workingDays.length,
      totalExpectedHours,
    };
  }, [previousMonthStart, previousMonthEnd, totalPreviousMonthHours]);

  const missedEntries = useMemo(() => calculateMissedEntries(timeEntries), [timeEntries]);

  const handleMissedEntryClick = (date: string) => {
    setPrefilledDate(date);
    setPrefilledProjectId(undefined);
    setShowAddTime(true);
  };

  const handleProjectClick = (projectId: string) => {
    setPrefilledProjectId(projectId);
    setPrefilledDate(undefined);
    setShowAddTime(true);
  };

  if (showAdminReports) {
    return <AdminReports onBack={() => setShowAdminReports(false)} />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-secondary">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-gradient-to-br from-primary to-accent rounded-lg flex items-center justify-center">
                <Clock className="w-5 h-5 text-white" />
              </div>
              <h1 className="text-xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                TimeTracker Pro
              </h1>
            </div>

            <div className="flex items-center space-x-4">
              <span className="text-sm text-muted-foreground">
                Benvenuto, {displayName || user?.email?.split("@")[0]}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowProfileSettings(true)}
                className="text-muted-foreground hover:text-foreground"
              >
                <Settings className="w-4 h-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={signOut}
                className="hover:bg-destructive/10 hover:border-destructive/20 hover:text-destructive"
              >
                <LogOut className="w-4 h-4 mr-2" />
                Esci
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 mb-8">
          <Button
            onClick={() => setShowAddProject(true)}
            className="bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 text-primary-foreground shadow-lg hover:shadow-xl transition-all duration-200"
          >
            <Plus className="w-4 h-4 mr-2" />
            Aggiungi Progetto
          </Button>

          <Button
            onClick={() => setShowAddTime(true)}
            className="bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 text-primary-foreground shadow-lg hover:shadow-xl transition-all duration-200"
            disabled={projects.length === 0}
          >
            <Clock className="w-4 h-4 mr-2" />
            Registra Ore
          </Button>

          {isAdmin && (
            <Button
              onClick={() => setShowAdminReports(true)}
              className="bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 text-primary-foreground shadow-lg hover:shadow-xl transition-all duration-200"
            >
              <FileText className="w-4 h-4 mr-2" />
              Report Admin
            </Button>
          )}
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <Card className="hover:shadow-lg transition-shadow duration-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600">Ore Mese Corrente</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-accent-foreground">{totalUserHours.toFixed(1)}</div>
              <p className="text-xs text-gray-500 mt-1">Ore rendicontate questo mese</p>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow duration-200">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-gray-600">
                  {showPreviousMonth ? "Mese Precedente" : "Progresso Mensile"}
                </CardTitle>
                <div className="flex items-center space-x-2">
                  <Label htmlFor="month-toggle" className="text-xs text-gray-500">
                    {showPreviousMonth ? "Precedente" : "Attuale"}
                  </Label>
                  <Switch id="month-toggle" checked={showPreviousMonth} onCheckedChange={setShowPreviousMonth} />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={showPreviousMonth ? previousMonthData.chartData : workingDaysData.chartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={2}
                      dataKey="value"
                      label={(entry) => `${entry.value.toFixed(1)}h`}
                      labelLine={false}
                    >
                      {(showPreviousMonth ? previousMonthData.chartData : workingDaysData.chartData).map(
                        (entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ),
                      )}
                    </Pie>
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <p className="text-xs text-gray-500 mt-2 text-center">
                {showPreviousMonth
                  ? `${previousMonthData.workingDaysCount} giorni lavorativi × 8h = ${previousMonthData.totalExpectedHours}h previste`
                  : `${workingDaysData.workingDaysCount} giorni lavorativi × 8h = ${workingDaysData.totalExpectedHours}h previste`}
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Projects */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center">
                  <TrendingUp className="w-5 h-5 mr-2 text-primary" />
                  Progetti
                </div>
                <Badge variant="secondary" className="bg-primary/10 text-primary">
                  {projects.length} aperti
                </Badge>
              </CardTitle>
              <CardDescription>Gestisci i tuoi progetti attivi</CardDescription>
            </CardHeader>
            <CardContent>
              {projects.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Plus className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                  <p>Nessun progetto ancora. Aggiungi il tuo primo progetto per iniziare!</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {projects.map((project) => (
                    <div
                      key={project.id}
                      className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
                      onClick={() => handleProjectClick(project.id)}
                    >
                      <div className="flex items-center space-x-3">
                        <div className="w-4 h-4 rounded-full" style={{ backgroundColor: project.color }} />
                        <div>
                          <h3 className="font-medium text-gray-900">{project.name}</h3>
                          <p className="text-sm text-gray-500">{project.description}</p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-3">
                        <div className="flex flex-col">
                          <Badge variant="secondary" className="bg-primary/10 text-primary mb-1">
                            {(project.userHours || 0).toFixed(1)}h / {(project.totalHours || 0).toFixed(1)}h
                          </Badge>
                          <span className="text-xs text-gray-500">Tue ore / Totali</span>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteProject(project.id);
                          }}
                          className="text-red-500 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Possible Missed Entries */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <AlertTriangle className="w-5 h-5 mr-2 text-yellow-600" />
                Possibili Voci Mancanti
              </CardTitle>
              <CardDescription>Giorni lavorativi con meno di 8 ore registrate</CardDescription>
            </CardHeader>
            <CardContent>
              {missedEntries.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Clock className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                  <p>Ottimo! Nessuna voce mancante nell'ultimo mese.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {missedEntries.slice(0, 10).map((entry) => (
                    <div
                      key={entry.date}
                      className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg hover:bg-yellow-100 transition-colors cursor-pointer"
                      onClick={() => handleMissedEntryClick(entry.date)}
                    >
                      <div className="flex items-center space-x-3">
                        <div className="w-3 h-3 bg-yellow-500 rounded-full" />
                        <div>
                          <h4 className="font-medium text-gray-900">{entry.formattedDate}</h4>
                          <p className="text-sm text-gray-500">
                            {entry.totalHours > 0 ? `${entry.totalHours}h registrate` : "Nessuna ora registrata"}
                          </p>
                        </div>
                      </div>
                      <Badge variant="outline" className="bg-yellow-100 text-yellow-700 border-yellow-300">
                        Mancano {8 - entry.totalHours}h
                      </Badge>
                    </div>
                  ))}
                  {missedEntries.length > 10 && (
                    <p className="text-sm text-gray-500 text-center pt-2">
                      E altri {missedEntries.length - 10} giorni...
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Time Entries */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Calendar className="w-5 h-5 mr-2 text-accent-foreground" />
                Voci Recenti
              </CardTitle>
              <CardDescription>I tuoi ultimi log temporali</CardDescription>
            </CardHeader>
            <CardContent>
              {recentEntries.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Clock className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                  <p>Nessuna voce temporale ancora. Inizia a registrare le tue ore!</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {recentEntries.map((entry) => {
                    const project = projects.find((p) => p.id === entry.project_id);
                    return (
                      <div
                        key={entry.id}
                        className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                      >
                        <div className="flex items-center space-x-3">
                          <div
                            className="w-4 h-4 rounded-full"
                            style={{ backgroundColor: project?.color || "#gray" }}
                          />
                          <div>
                            <h3 className="font-medium text-gray-900">{project?.name}</h3>
                            <p className="text-sm text-gray-500">{entry.description}</p>
                            <p className="text-xs text-gray-400">{new Date(entry.date).toLocaleDateString()}</p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-3">
                          <Badge variant="secondary" className="bg-accent/20 text-accent-foreground">
                            {entry.hours}h
                          </Badge>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteTimeEntry(entry.id)}
                            className="text-red-500 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <AddProjectDialog
        open={showAddProject}
        onOpenChange={setShowAddProject}
        canCreateProject={isProjectOwner || isAdmin}
      />
      <AddTimeDialog
        open={showAddTime}
        onOpenChange={(open) => {
          setShowAddTime(open);
          if (!open) {
            setPrefilledDate(undefined);
            setPrefilledProjectId(undefined);
          }
        }}
        prefilledDate={prefilledDate}
        prefilledProjectId={prefilledProjectId}
      />

      <ProfileSettingsDialog
        open={showProfileSettings}
        onOpenChange={(open) => {
          setShowProfileSettings(open);
          if (!open) {
            // Refresh display name when dialog closes
            supabase
              .from("profiles")
              .select("display_name")
              .eq("user_id", user?.id)
              .single()
              .then(({ data }) => {
                if (data?.display_name) setDisplayName(data.display_name);
              });
          }
        }}
      />
    </div>
  );
};

export default Dashboard;
