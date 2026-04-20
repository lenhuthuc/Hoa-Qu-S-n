"use client";

import React, { useState } from 'react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  Plugin
} from 'chart.js';

// Đăng ký các thành phần mặc định
ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler);

// 1. Định nghĩa Plugin để vẽ chữ đơn vị ngay trên đầu trục Y
const unitLabelPlugin: Plugin<'line'> = {
  id: 'unitLabel',
  afterDraw: (chart) => {
    const { ctx, chartArea: { top }, scales: { y } } = chart;
    ctx.save();
    ctx.fillStyle = '#9ca3af'; // Màu xám (text-gray-400)
    ctx.font = '12px Inter, sans-serif';
    ctx.textAlign = 'left';
    // Vẽ chữ "Triệu VNĐ" cách phía trên trục Y 15px
    ctx.fillText('Triệu VNĐ', y.left, top - 15);
    ctx.restore();
  }
};

// Đăng ký plugin vừa tạo
ChartJS.register(unitLabelPlugin);

export default function SalesChart() {
  const [timeRange, setTimeRange] = useState<'1m' | '6m' | '1y' | 'all'>('1m');

  const getChartData = () => {
    switch (timeRange) {
      case '1m':
        return { labels: ['Tuần 1', 'Tuần 2', 'Tuần 3', 'Tuần 4'], values: [5, 12, 8, 15] };
      case '1y':
        return { labels: ['Q1', 'Q2', 'Q3', 'Q4'], values: [150, 200, 180, 250] };
      case 'all':
        return { labels: ['2024', '2025', '2026'], values: [500, 1200, 800] };
      case '6m':
      default:
        return { 
          labels: ['Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4', 'Tháng 5', 'Tháng 6'], 
          values: [12, 19, 30, 15, 20, 35] 
        };
    }
  };

  const currentData = getChartData();

  const data = {
    labels: currentData.labels,
    datasets: [
      {
        label: 'Doanh thu',
        data: currentData.values,
        borderColor: '#10b981',
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        tension: 0.4,
        fill: true,
        pointRadius: 4,
        pointBackgroundColor: '#fff',
        pointBorderWidth: 2,
      },
    ],
  };

  const options: any = {
    responsive: true,
    maintainAspectRatio: false,
    layout: {
      // Quan trọng: Tạo khoảng trống phía trên để chữ "Triệu VNĐ" không bị mất
      padding: {
        top: 30,
      }
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#1f2937',
        padding: 10,
        callbacks: {
          label: (context: any) => `Doanh thu: ${context.parsed.y} Tr`,
        }
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          color: '#9ca3af',
          font: { size: 11 }
        },
        grid: {
          color: '#f3f4f6',
        },
        border: { display: false }
      },
      x: {
        ticks: {
          color: '#9ca3af',
          font: { size: 11 }
        },
        grid: { display: false },
        border: { display: false }
      },
    },
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mt-6 mb-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-gray-800">Thống kê doanh thu</h3>
        
        <div className="flex space-x-2 bg-gray-50 p-1 rounded-lg border border-gray-100">
          {[
            { id: '1m', label: '1 Tháng' },
            { id: '6m', label: '6 Tháng' },
            { id: '1y', label: '1 Năm' },
            { id: 'all', label: 'Tất cả' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setTimeRange(tab.id as any)}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${
                timeRange === tab.id
                  ? 'bg-white text-green-600 shadow-sm border border-gray-200'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="h-[300px] w-full">
        <Line data={data} options={options} />
      </div>
    </div>
  );
}