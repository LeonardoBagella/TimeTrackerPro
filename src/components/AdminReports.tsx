import React, { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { FileText, Search, ChevronLeft, Download } from "lucide-react";
import { format, subMonths, isAfter } from "date-fns";
import { it } from "date-fns/locale";
import * as XLSX from "xlsx";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

interface TimeEntry {
  id: string;
  project_id: string;
  user_id: string;
  hours: number;
  description: string;
  date: string;
  created_at: string;
}

interface Project {
  id: string;
  name: string;
  color: string;
}

interface Profile {
  user_id: string;
  display_name: string | null;
}

interface EnrichedTimeEntry extends TimeEntry {
  project_name: string;
  project_color: string;
  user_name: string;
}

interface ProjectBudgetData {
  project_id: string;
  project_name: string;
  budget: number;
  actual_cost: number;
}

const ITEMS_PER_PAGE = 20;

const AdminReports = ({ onBack }: { onBack: () => void }) => {
  const { isAdmin, isLoading: roleLoading } = useUserRole();
  const [timeEntries, setTimeEntries] = useState<EnrichedTimeEntry[]>([]);
  const [allTimeEntries, setAllTimeEntries] = useState<EnrichedTimeEntry[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    if (!roleLoading && isAdmin) {
      fetchAllData();
    }
  }, [roleLoading, isAdmin]);

  const fetchAllData = async () => {
    setIsLoading(true);
    try {
      // Calculate date 3 months ago
      const threeMonthsAgo = subMonths(new Date(), 3);
      const threeMonthsAgoDate = format(threeMonthsAgo, "yyyy-MM-dd");

      // Fetch time entries from last 3 months for the table
      const { data: entries, error: entriesError } = await supabase
        .from("time_entries")
        .select("*")
        .gte("date", threeMonthsAgoDate)
        .order("date", { ascending: false });

      if (entriesError) throw entriesError;

      // Fetch ALL time entries for cost calculation
      const { data: allEntries, error: allEntriesError } = await supabase.from("time_entries").select("*");

      if (allEntriesError) throw allEntriesError;

      // Fetch projects with budget
      const { data: projects, error: projectsError } = await supabase
        .from("projects")
        .select("id, name, color, budget");

      if (projectsError) throw projectsError;

      // Fetch profiles with daily_cost
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("user_id, display_name, daily_cost");

      if (profilesError) throw profilesError;

      // Create lookup maps
      const projectMap = new Map<string, any>(projects?.map((p) => [p.id, p]) || []);
      const profileMap = new Map<string, any>(profiles?.map((p) => [p.user_id, p]) || []);

      // Enrich time entries (last 3 months)
      const enrichedEntries: EnrichedTimeEntry[] = (entries || []).map((entry) => ({
        ...entry,
        project_name: projectMap.get(entry.project_id)?.name || "Progetto sconosciuto",
        project_color: projectMap.get(entry.project_id)?.color || "#gray",
        user_name: profileMap.get(entry.user_id)?.display_name || "Utente sconosciuto",
      }));

      // Enrich all time entries for cost calculation
      const enrichedAllEntries: EnrichedTimeEntry[] = (allEntries || []).map((entry) => ({
        ...entry,
        project_name: projectMap.get(entry.project_id)?.name || "Progetto sconosciuto",
        project_color: projectMap.get(entry.project_id)?.color || "#gray",
        user_name: profileMap.get(entry.user_id)?.display_name || "Utente sconosciuto",
      }));

      setTimeEntries(enrichedEntries);
      setAllTimeEntries(enrichedAllEntries);
      setProjects(projects || []);
      setProfiles(profiles || []);
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredEntries = useMemo(() => {
    if (!searchTerm) return timeEntries;

    const term = searchTerm.toLowerCase();
    return timeEntries.filter(
      (entry) =>
        entry.project_name.toLowerCase().includes(term) ||
        entry.user_name.toLowerCase().includes(term) ||
        entry.description.toLowerCase().includes(term) ||
        format(new Date(entry.date), "dd/MM/yyyy").includes(term),
    );
  }, [timeEntries, searchTerm]);

  const totalPages = Math.ceil(filteredEntries.length / ITEMS_PER_PAGE);
  const paginatedEntries = filteredEntries.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  const totalHours = useMemo(() => {
    return filteredEntries.reduce((sum, entry) => sum + Number(entry.hours), 0);
  }, [filteredEntries]);

  const budgetChartData = useMemo(() => {
    // Get unique projects from filtered entries
    const filteredProjectIds = new Set(filteredEntries.map((e) => e.project_id));

    // Create lookup maps
    const profileMap = new Map(profiles.map((p) => [p.user_id, p]));
    const projectMap = new Map(projects.map((p) => [p.id, p]));

    // Calculate actual costs per project using ALL time entries
    const projectCosts = new Map<string, { name: string; budget: number; cost: number }>();

    allTimeEntries.forEach((entry) => {
      if (!filteredProjectIds.has(entry.project_id)) return;

      if (!projectCosts.has(entry.project_id)) {
        const project = projectMap.get(entry.project_id);
        projectCosts.set(entry.project_id, {
          name: entry.project_name,
          budget: project?.budget || 0,
          cost: 0,
        });
      }

      const projectData = projectCosts.get(entry.project_id)!;
      const profile = profileMap.get(entry.user_id);
      const dailyCost = profile?.daily_cost || 0;
      const days = Number(entry.hours) / 8;
      projectData.cost += days * dailyCost;
    });

    return Array.from(projectCosts.values())
      .filter((p) => p.budget > 0) // Only show projects with budget set
      .map((p) => ({
        name: p.name.length > 10 ? p.name.substring(0, 10) + "..." : p.name,
        Budget: p.budget,
        "Costo Attuale": Math.round(p.cost),
      }));
  }, [filteredEntries, allTimeEntries, projects, profiles]);

  const handleExportExcel = () => {
    // Prepare data for export
    const exportData = filteredEntries.map((entry) => ({
      Data: format(new Date(entry.date), "dd/MM/yyyy"),
      Progetto: entry.project_name,
      Utente: entry.user_name,
      Descrizione: entry.description,
      Ore: entry.hours,
    }));

    // Create worksheet
    const worksheet = XLSX.utils.json_to_sheet(exportData);

    // Set column widths
    worksheet["!cols"] = [
      { wch: 12 }, // Data
      { wch: 25 }, // Progetto
      { wch: 20 }, // Utente
      { wch: 40 }, // Descrizione
      { wch: 8 }, // Ore
    ];

    // Create workbook
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Registrazioni");

    // Generate filename with current date
    const fileName = `report_registrazioni_${format(new Date(), "yyyy-MM-dd")}.xlsx`;

    // Save file
    XLSX.writeFile(workbook, fileName);
  };

  if (roleLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background to-secondary flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p>Caricamento...</p>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background to-secondary flex items-center justify-center">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Accesso Negato</CardTitle>
            <CardDescription>Non hai i permessi per accedere a questa sezione.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={onBack}>
              <ChevronLeft className="w-4 h-4 mr-2" />
              Torna alla Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-secondary">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-3">
              <Button variant="ghost" size="sm" onClick={onBack}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <FileText className="w-6 h-6 text-primary" />
              <h1 className="text-xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                Report Amministratore
              </h1>
            </div>
            <Badge variant="secondary" className="bg-primary/10 text-primary">
              Admin
            </Badge>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {budgetChartData.length > 0 && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Budget vs Costo Attuale per Progetto</CardTitle>
              <CardDescription>
                Confronto tra budget allocato e costo effettivo calcolato su tutte le registrazioni
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={budgetChartData} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    type="number"
                    scale="sqrt"
                    domain={["auto", Math.max(...budgetChartData.map((d) => d.Budget)) + 100000]}
                    tickFormatter={(value) => `${(value / 1000).toFixed(1)}K€`}
                  />
                  <YAxis dataKey="name" type="category" width={75} />
                  <Tooltip formatter={(value: number) => `${(value / 1000).toFixed(1)}K€`} />
                  <Legend />
                  <Bar
                    dataKey="Budget"
                    fill="hsl(var(--primary))"
                    label={{ position: "right", formatter: (value: number) => `${(value / 1000).toFixed(1)}K€` }}
                  />
                  <Bar
                    dataKey="Costo Attuale"
                    fill="hsl(var(--accent))"
                    label={{ position: "right", formatter: (value: number) => `${(value / 1000).toFixed(1)}K€` }}
                  />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <CardTitle className="flex items-center">
                  <FileText className="w-5 h-5 mr-2 text-primary" />
                  Tutte le Registrazioni degli ultimi 3 mesi
                </CardTitle>
                <CardDescription>
                  {filteredEntries.length} registrazioni • {totalHours.toFixed(1)} ore totali
                </CardDescription>
              </div>
              <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    placeholder="Cerca per progetto, utente, descrizione..."
                    value={searchTerm}
                    onChange={(e) => {
                      setSearchTerm(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="pl-10"
                  />
                </div>
                <Button
                  onClick={handleExportExcel}
                  variant="outline"
                  className="border-primary/20 hover:bg-primary/10"
                  disabled={filteredEntries.length === 0}
                >
                  <Download className="w-4 h-4 mr-2" />
                  Esporta Excel
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-12">
                <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                <p>Caricamento dati...</p>
              </div>
            ) : paginatedEntries.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <FileText className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                <p>Nessuna registrazione trovata.</p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data</TableHead>
                        <TableHead>Progetto</TableHead>
                        <TableHead>Utente</TableHead>
                        <TableHead>Descrizione</TableHead>
                        <TableHead className="text-right">Ore</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedEntries.map((entry) => (
                        <TableRow key={entry.id}>
                          <TableCell className="font-medium">
                            {format(new Date(entry.date), "dd MMM yyyy", { locale: it })}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center space-x-2">
                              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: entry.project_color }} />
                              <span>{entry.project_name}</span>
                            </div>
                          </TableCell>
                          <TableCell>{entry.user_name}</TableCell>
                          <TableCell className="max-w-xs truncate">{entry.description}</TableCell>
                          <TableCell className="text-right">
                            <Badge variant="secondary" className="bg-accent/20 text-accent-foreground">
                              {entry.hours}h
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {totalPages > 1 && (
                  <div className="mt-6">
                    <Pagination>
                      <PaginationContent>
                        <PaginationItem>
                          <PaginationPrevious
                            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                            className={currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                          />
                        </PaginationItem>

                        {Array.from({ length: totalPages }, (_, i) => i + 1)
                          .filter((page) => {
                            if (totalPages <= 7) return true;
                            if (page === 1 || page === totalPages) return true;
                            if (page >= currentPage - 1 && page <= currentPage + 1) return true;
                            return false;
                          })
                          .map((page, index, array) => {
                            if (index > 0 && array[index - 1] !== page - 1) {
                              return (
                                <React.Fragment key={`ellipsis-${page}`}>
                                  <PaginationItem>
                                    <span className="px-4">...</span>
                                  </PaginationItem>
                                  <PaginationItem>
                                    <PaginationLink
                                      onClick={() => setCurrentPage(page)}
                                      isActive={currentPage === page}
                                      className="cursor-pointer"
                                    >
                                      {page}
                                    </PaginationLink>
                                  </PaginationItem>
                                </React.Fragment>
                              );
                            }
                            return (
                              <PaginationItem key={page}>
                                <PaginationLink
                                  onClick={() => setCurrentPage(page)}
                                  isActive={currentPage === page}
                                  className="cursor-pointer"
                                >
                                  {page}
                                </PaginationLink>
                              </PaginationItem>
                            );
                          })}

                        <PaginationItem>
                          <PaginationNext
                            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                            className={currentPage === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                          />
                        </PaginationItem>
                      </PaginationContent>
                    </Pagination>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AdminReports;
