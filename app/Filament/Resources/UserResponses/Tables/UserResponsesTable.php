<?php

namespace App\Filament\Resources\UserResponses\Tables;

use App\Enums\Quadrant;
use Filament\Tables\Columns\IconColumn;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Filters\SelectFilter;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Builder;

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
                SelectFilter::make('question_quadrant')
                    ->label('Question Quadrant')
                    ->options(Quadrant::class)
                    ->query(function (Builder $query, array $data): Builder {
                        return $query->when(
                            $data['value'] ?? null,
                            fn (Builder $query, string $value): Builder => $query->whereHas(
                                'question',
                                fn (Builder $q) => $q->where('quadrant', $value)
                            )
                        );
                    }),
            ]);
    }
}
