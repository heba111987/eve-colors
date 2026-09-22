<?php

namespace App\Filament\Resources\UserResponses\Tables;

use Filament\Tables\Columns\IconColumn;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Filters\SelectFilter;
use Filament\Tables\Table;

class UserResponsesTable
{
    public static function configure(Table $table): Table
    {
        return $table
            ->columns([
                TextColumn::make('user.email')->label('User')->searchable(),
                TextColumn::make('color.name')->label('Color'),
                TextColumn::make('question.quadrant')->label('Q Quadrant'),
                TextColumn::make('activity.quadrant')->label('Activity Quadrant'),
                TextColumn::make('entry_date')->date(),
                IconColumn::make('activity_completed')->boolean(),
            ])
            ->filters([
                SelectFilter::make('question.quadrant')
                    ->relationship('question', 'quadrant')
                    ->options([
                        'mental' => 'Mental', 'physical' => 'Physical',
                        'emotional' => 'Emotional', 'spiritual' => 'Spiritual',
                    ]),
            ]);
    }
}
