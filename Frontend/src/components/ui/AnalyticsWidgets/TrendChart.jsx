import React from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import "./TrendChart.scss";

const TrendChart = ({ data }) => {
    if (!data || data.length === 0) {
        return (
            <div className="trend-chart-card empty">
                <h3>Performance Trends</h3>
                <p>Not enough chronological data to generate a trend chart yet.</p>
            </div>
        );
    }

    // Map data for recharts
    const chartData = data.map((attempt, index) => ({
        name: `T-${data.length - index}`,
        score: attempt.overallScore || 0,
        type: attempt.type,
        date: new Date(attempt.date).toLocaleDateString()
    }));

    return (
        <div className="trend-chart-card">
            <div className="chart-header">
                <h3>Performance Trends</h3>
                <p className="subtitle">Chronological progression of evaluation scores over time.</p>
            </div>
            
            <div className="chart-container" style={{ width: "100%", height: 300 }}>
                <ResponsiveContainer>
                    <LineChart
                        data={chartData}
                        margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
                    >
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                        <XAxis 
                            dataKey="date" 
                            stroke="#94a3b8" 
                            tick={{ fill: '#94a3b8', fontSize: 12 }} 
                        />
                        <YAxis 
                            stroke="#94a3b8" 
                            tick={{ fill: '#94a3b8', fontSize: 12 }} 
                            domain={[0, 100]} 
                        />
                        <Tooltip 
                            contentStyle={{ backgroundColor: "#1e293b", borderColor: "#334155", color: "#f8fafc", borderRadius: "8px" }}
                            itemStyle={{ color: "#38bdf8" }}
                            formatter={(value) => [`${value}%`, "Score"]}
                        />
                        <Line 
                            type="monotone" 
                            dataKey="score" 
                            stroke="#38bdf8" 
                            strokeWidth={3} 
                            activeDot={{ r: 8, fill: "#38bdf8", stroke: "#0f172a", strokeWidth: 2 }} 
                        />
                    </LineChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};

export default TrendChart;
